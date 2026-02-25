import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, TextField, Typography, Button,
  Chip, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert,
} from '@mui/material';
import { Save } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import type { Category, ExtractedReceipt } from '../types';
import { usersApi, recordsApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCategories } from '../contexts/CategoriesContext';
import CardSelector from '../components/CardSelector';
import AmountSplitter from '../components/AmountSplitter';
import ParticipantSelector from '../components/ParticipantSelector';
import FavoritesDialog from '../components/FavoritesDialog';
import { nowKST } from '../utils/datetime';

interface UserItem {
  user_id: string;
  name: string;
  department: string;
  is_favorite: boolean;
}

const ReceiptReviewPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { categories, labelOf, iconOf } = useCategories();
  const analyzed = location.state?.analyzed as {
    image_key: string;
    image_url: string;
    extracted: ExtractedReceipt;
  } | undefined;
  const presetCategory = location.state?.presetCategory as Category | undefined;

  const ext = analyzed?.extracted;

  const [category, setCategory] = useState<Category>(presetCategory || 'LUNCH');
  const [storeName, setStoreName] = useState(ext?.store_name || '');
  const [approvalNumber, setApprovalNumber] = useState(ext?.approval_number || '');
  const [totalAmount, setTotalAmount] = useState(ext?.total_amount?.toString() || '');
  const [transactionDate, setTransactionDate] = useState(ext?.transaction_date || '');
  const [cardLast4, setCardLast4] = useState(ext?.card_last4 || '');
  const [memo, setMemo] = useState('');

  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [favDialog, setFavDialog] = useState(false);

  const loadUsers = useCallback(() => {
    usersApi.list().then((res) => {
      setAllUsers(res.data.users);
    });
  }, []);

  useEffect(() => {
    loadUsers();
    if (me) {
      setSelectedParticipants([me.user_id]);
    }
  }, [me, loadUsers]);

  useEffect(() => {
    recalcAmounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParticipants, totalAmount, splitMode]);

  const recalcAmounts = () => {
    if (splitMode !== 'equal') return;
    const total = parseFloat(totalAmount) || 0;
    const count = selectedParticipants.length || 1;
    const each = Math.floor(total / count);
    const newAmounts: Record<string, number> = {};
    selectedParticipants.forEach((uid, i) => {
      newAmounts[uid] = i === 0 ? total - each * (count - 1) : each;
    });
    setAmounts(newAmounts);
  };

  const handleSplitModeChange = (mode: 'equal' | 'custom') => {
    setSplitMode(mode);
    if (mode === 'equal') {
      const total = parseFloat(totalAmount) || 0;
      const count = selectedParticipants.length || 1;
      const each = Math.floor(total / count);
      const next: Record<string, number> = {};
      selectedParticipants.forEach((uid, i) => {
        next[uid] = i === 0 ? total - each * (count - 1) : each;
      });
      setAmounts(next);
    }
  };

  const handleAmountChange = (uid: string, value: number) => {
    setAmounts((prev) => ({ ...prev, [uid]: value }));
  };

  const toggleParticipant = (uid: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSave = async () => {
    if (!storeName && !ext?.store_name) {
      setError('상호명을 입력해주세요.');
      return;
    }
    if (!totalAmount || isNaN(parseFloat(totalAmount))) {
      setError('결제금액을 입력해주세요.');
      return;
    }

    if (selectedParticipants.length > 1) {
      const splitTotal = Object.values(amounts).reduce((a, b) => a + b, 0);
      const total = parseFloat(totalAmount);
      if (splitTotal !== total) {
        setError(`금액 분배 합계(₩${splitTotal.toLocaleString()})가 결제금액(₩${total.toLocaleString()})과 일치하지 않습니다.`);
        return;
      }
    }

    setSaving(true);
    setError('');

    const participants = selectedParticipants.length > 1
      ? selectedParticipants.map((uid) => {
          const u = allUsers.find((u) => u.user_id === uid);
          return { user_id: uid, name: u?.name || uid, amount: amounts[uid] || 0 };
        })
      : [];

    try {
      await recordsApi.create({
        category,
        approval_number: approvalNumber || null,
        store_name: storeName,
        total_amount: parseFloat(totalAmount),
        transaction_date: transactionDate || nowKST(),
        order_details: ext?.order_details || [],
        image_key: analyzed?.image_key || null,
        participants,
        memo: memo || null,
        card_last4: cardLast4 || null,
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };


  return (
    <Layout title="영수증 확인 및 등록" showBack>
      <Box sx={{ p: 2, pb: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {analyzed?.image_url && (
          <Card sx={{ mb: 2 }}>
            <img
              src={analyzed.image_url}
              alt="영수증"
              style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }}
            />
          </Card>
        )}

        {/* AI 추출 결과 편집 */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              📋 사용 정보
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel>카테고리</InputLabel>
              <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} label="카테고리">
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="상호명" value={storeName} onChange={(e) => setStoreName(e.target.value)} fullWidth margin="normal" />
            <TextField label="결제금액 (원)" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} type="number" fullWidth margin="normal" />
            <TextField label="사용일시 (YYYY-MM-DD HH:mm)" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} fullWidth margin="normal" />
            <TextField label="승인번호" value={approvalNumber} onChange={(e) => setApprovalNumber(e.target.value)} fullWidth margin="normal" />
            <CardSelector value={cardLast4} onChange={setCardLast4} extractedLast4={ext?.card_last4} />
            <TextField label="메모" value={memo} onChange={(e) => setMemo(e.target.value)} fullWidth margin="normal" multiline rows={2} />
          </CardContent>
        </Card>

        {/* AI 인식 유형 뱃지 */}
        {ext?.receipt_type && ext.receipt_type !== 'UNKNOWN' && (
          <Box sx={{ mb: 1.5 }}>
            <Chip
              size="small"
              label={{
                RECEIPT: '📄 종이 영수증',
                KIOSK: '🖥️ 키오스크 화면',
                TABLET: '📱 태블릿 주문',
                SCREEN: '🖥️ 결제 화면',
              }[ext.receipt_type] || ext.receipt_type}
              color="info"
              variant="outlined"
            />
          </Box>
        )}

        {/* 함께한 사람 */}
        <ParticipantSelector
          allUsers={allUsers}
          selectedParticipants={selectedParticipants}
          onToggle={toggleParticipant}
          onManageFavorites={() => setFavDialog(true)}
        />
        <FavoritesDialog
          open={favDialog}
          onClose={() => setFavDialog(false)}
          onChanged={() => loadUsers()}
        />

        {/* 금액 분배 (2명 이상) */}
        {selectedParticipants.length > 1 && (
          <AmountSplitter
            participants={selectedParticipants.map((uid) => {
              const u = allUsers.find((u) => u.user_id === uid);
              return { user_id: uid, name: u?.name || (uid === me?.user_id ? me?.name || uid : uid) };
            })}
            amounts={amounts}
            totalAmount={parseFloat(totalAmount) || 0}
            splitMode={splitMode}
            onSplitModeChange={handleSplitModeChange}
            onAmountChange={handleAmountChange}
          />
        )}

        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
          sx={{ py: 1.8 }}
        >
          {saving ? '저장 중...' : '등록 완료'}
        </Button>
      </Box>
    </Layout>
  );
};

export default ReceiptReviewPage;
