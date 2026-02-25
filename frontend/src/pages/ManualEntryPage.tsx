import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, TextField, Typography, Button,
  Select, MenuItem, FormControl, InputLabel,
  IconButton,
  CircularProgress, Alert, InputAdornment,
} from '@mui/material';
import { Save, Add, Delete } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import type { Category } from '../types';
import { usersApi, recordsApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCategories } from '../contexts/CategoriesContext';
import CardSelector from '../components/CardSelector';
import AmountSplitter from '../components/AmountSplitter';
import ParticipantSelector from '../components/ParticipantSelector';
import { nowKST } from '../utils/datetime';

interface UserItem {
  user_id: string;
  name: string;
  department: string;
  is_favorite: boolean;
}

interface OrderLine {
  item: string;
  quantity: number;
  price: number;
}

const ManualEntryPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { categories } = useCategories();

  const presetCategory = location.state?.presetCategory as Category | undefined;

  const [category, setCategory] = useState<Category>(presetCategory || 'LUNCH');
  const [storeName, setStoreName] = useState('');
  const [approvalNumber, setApprovalNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(nowKST());
  const [cardLast4, setCardLast4] = useState('');
  const [memo, setMemo] = useState('');

  // 주문 세부 내역
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);

  // 참여자
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = useCallback(() => {
    usersApi.list().then((res) => setAllUsers(res.data.users));
  }, []);

  useEffect(() => {
    loadUsers();
    if (me) setSelectedParticipants([me.user_id]);
  }, [me, loadUsers]);

  useEffect(() => {
    if (splitMode !== 'equal') return;
    const total = parseFloat(totalAmount) || 0;
    const count = selectedParticipants.length || 1;
    const each = Math.floor(total / count);
    const next: Record<string, number> = {};
    selectedParticipants.forEach((uid, i) => {
      next[uid] = i === 0 ? total - each * (count - 1) : each;
    });
    setAmounts(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParticipants, totalAmount, splitMode]);

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

  // 주문 내역 관리
  const addOrderLine = () => {
    setOrderLines((prev) => [...prev, { item: '', quantity: 1, price: 0 }]);
  };

  const updateOrderLine = (idx: number, field: keyof OrderLine, value: string | number) => {
    setOrderLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const removeOrderLine = (idx: number) => {
    setOrderLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // 세부 내역 합계로 총액 자동 계산
  const calcFromLines = () => {
    const sum = orderLines.reduce((acc, l) => acc + (l.quantity * l.price), 0);
    if (sum > 0) setTotalAmount(sum.toString());
  };

  const handleSave = async () => {
    if (!storeName.trim()) { setError('상호명을 입력해주세요.'); return; }
    if (!totalAmount || isNaN(parseFloat(totalAmount))) { setError('결제금액을 입력해주세요.'); return; }

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

    const validOrderLines = orderLines.filter((l) => l.item.trim());

    try {
      await recordsApi.create({
        category,
        approval_number: approvalNumber || null,
        store_name: storeName,
        total_amount: parseFloat(totalAmount),
        transaction_date: transactionDate || nowKST(),
        order_details: validOrderLines,
        image_key: null,
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
    <Layout title="직접 입력" showBack>
      <Box sx={{ p: 2, pb: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 기본 정보 */}
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

            <TextField
              label="상호명 *"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              fullWidth margin="normal"
              placeholder="예: 한우리식당, 스타벅스 강남점"
            />
            <TextField
              label="결제금액 (원) *"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              type="number"
              fullWidth margin="normal"
              InputProps={{ startAdornment: <InputAdornment position="start">₩</InputAdornment> }}
            />
            <TextField
              label="사용일시"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              fullWidth margin="normal"
              placeholder="YYYY-MM-DD HH:mm"
            />
            <TextField
              label="승인번호"
              value={approvalNumber}
              onChange={(e) => setApprovalNumber(e.target.value)}
              fullWidth margin="normal"
              placeholder="카드 승인번호 (없으면 생략)"
            />
            <CardSelector value={cardLast4} onChange={setCardLast4} />
            <TextField
              label="메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              fullWidth margin="normal"
              multiline rows={2}
              placeholder="추가 설명 (선택)"
            />
          </CardContent>
        </Card>

        {/* 세부 내역 (선택) */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                🧾 세부 내역 <Typography component="span" variant="caption" color="text.secondary">(선택)</Typography>
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={addOrderLine}>추가</Button>
            </Box>

            {orderLines.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 1.5 }}>
                항목을 추가하면 합계를 자동 계산할 수 있습니다
              </Typography>
            ) : (
              <>
                {orderLines.map((line, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                    <TextField
                      label="항목명"
                      value={line.item}
                      onChange={(e) => updateOrderLine(idx, 'item', e.target.value)}
                      size="small"
                      sx={{ flex: 2 }}
                      placeholder="예: 삼겹살"
                    />
                    <TextField
                      label="수량"
                      value={line.quantity}
                      onChange={(e) => updateOrderLine(idx, 'quantity', parseInt(e.target.value) || 1)}
                      type="number"
                      size="small"
                      sx={{ width: 60 }}
                      inputProps={{ min: 1 }}
                    />
                    <TextField
                      label="단가"
                      value={line.price}
                      onChange={(e) => updateOrderLine(idx, 'price', parseFloat(e.target.value) || 0)}
                      type="number"
                      size="small"
                      sx={{ flex: 1.5 }}
                      InputProps={{ startAdornment: <InputAdornment position="start">₩</InputAdornment> }}
                    />
                    <IconButton size="small" onClick={() => removeOrderLine(idx)} color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    소계: ₩{orderLines.reduce((s, l) => s + l.quantity * l.price, 0).toLocaleString()}
                  </Typography>
                  <Button size="small" variant="outlined" onClick={calcFromLines}>
                    합계 적용
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>

        {/* 함께한 사람 */}
        <ParticipantSelector
          allUsers={allUsers}
          selectedParticipants={selectedParticipants}
          onToggle={toggleParticipant}
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
          variant="contained" size="large" fullWidth
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

export default ManualEntryPage;
