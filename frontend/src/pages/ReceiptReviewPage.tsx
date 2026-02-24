import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, TextField, Typography, Button,
  Chip, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, ListItemAvatar, ListItemSecondaryAction,
  IconButton, Divider, Avatar, Checkbox,
  CircularProgress, Alert, Tooltip,
} from '@mui/material';
import { Save, Star, StarBorder } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import type { Category, ExtractedReceipt } from '../types';
import { usersApi, recordsApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCategories } from '../contexts/CategoriesContext';
import CardSelector from '../components/CardSelector';

const MEAL_CATEGORIES: Category[] = ['LUNCH', 'DINNER', 'ENTERTAINMENT'];

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
  const isMealCategory = MEAL_CATEGORIES.includes(category);
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
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const toggleParticipant = (uid: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const toggleFavorite = async (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favoriteLoading) return;
    setFavoriteLoading(uid);
    try {
      const res = await usersApi.toggleFavorite(uid);
      const { is_favorite } = res.data;
      setAllUsers((prev) =>
        prev
          .map((u) => (u.user_id === uid ? { ...u, is_favorite } : u))
          .sort((a, b) => {
            if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
            return a.name.localeCompare(b.name, 'ko');
          })
      );
    } finally {
      setFavoriteLoading(null);
    }
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
    setSaving(true);
    setError('');

    const participants = isMealCategory
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
        transaction_date: transactionDate || new Date().toISOString().slice(0, 16).replace('T', ' '),
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

  const favoriteUsers = allUsers.filter((u) => u.is_favorite && u.user_id !== me?.user_id);
  const otherUsers = allUsers.filter((u) => !u.is_favorite && u.user_id !== me?.user_id);

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

        {/* 참여자 선택 — 식사 카테고리만 표시 */}
        {isMealCategory && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              👥 함께한 사람
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
              ⭐ 별표로 즐겨찾기 등록 · 체크로 이번 식사 참여자 선택
            </Typography>

            {/* 나 자신 (항상 포함, 체크 불가) */}
            {me && (
              <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5, px: 0.5, bgcolor: 'action.hover', borderRadius: 1, mb: 1 }}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'primary.main', mr: 1.5 }}>
                  {me.name?.[0]}
                </Avatar>
                <Typography variant="body2" flex={1} fontWeight={600}>
                  {me.name} (나)
                </Typography>
                <Checkbox checked size="small" disabled />
              </Box>
            )}

            {/* 즐겨찾기 사용자 */}
            {favoriteUsers.length > 0 && (
              <>
                <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ display: 'block', mt: 1, mb: 0.5 }}>
                  ⭐ 즐겨찾기
                </Typography>
                <List dense disablePadding>
                  {favoriteUsers.map((u) => (
                    <ListItem
                      key={u.user_id}
                      disablePadding
                      sx={{ py: 0.2, cursor: 'pointer' }}
                      onClick={() => toggleParticipant(u.user_id)}
                    >
                      <Checkbox
                        checked={selectedParticipants.includes(u.user_id)}
                        size="small"
                        sx={{ p: 0.5 }}
                      />
                      <ListItemAvatar sx={{ minWidth: 36 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'warning.light' }}>
                          {u.name[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={u.name}
                        secondary={u.department}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="즐겨찾기 해제">
                          <IconButton
                            size="small"
                            onClick={(e) => toggleFavorite(u.user_id, e)}
                            disabled={favoriteLoading === u.user_id}
                          >
                            {favoriteLoading === u.user_id
                              ? <CircularProgress size={16} />
                              : <Star sx={{ color: 'warning.main', fontSize: 20 }} />
                            }
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {/* 나머지 직원 */}
            {otherUsers.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.5 }}>
                  전체 직원
                </Typography>
                <Box sx={{ maxHeight: 220, overflow: 'auto' }}>
                  <List dense disablePadding>
                    {otherUsers.map((u) => (
                      <ListItem
                        key={u.user_id}
                        disablePadding
                        sx={{ py: 0.2, cursor: 'pointer' }}
                        onClick={() => toggleParticipant(u.user_id)}
                      >
                        <Checkbox
                          checked={selectedParticipants.includes(u.user_id)}
                          size="small"
                          sx={{ p: 0.5 }}
                        />
                        <ListItemAvatar sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 13 }}>
                            {u.name[0]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={u.name}
                          secondary={u.department}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="즐겨찾기 추가">
                            <IconButton
                              size="small"
                              onClick={(e) => toggleFavorite(u.user_id, e)}
                              disabled={favoriteLoading === u.user_id}
                            >
                              {favoriteLoading === u.user_id
                                ? <CircularProgress size={16} />
                                : <StarBorder sx={{ fontSize: 20, color: 'text.disabled' }} />
                              }
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </>
            )}

            {selectedParticipants.length > 0 && (
              <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selectedParticipants.map((uid) => {
                  const u = allUsers.find((u) => u.user_id === uid);
                  const isMe = uid === me?.user_id;
                  return (
                    <Chip
                      key={uid}
                      label={u?.name || uid}
                      size="small"
                      color="primary"
                      variant="filled"
                      onDelete={isMe ? undefined : () => toggleParticipant(uid)}
                    />
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
        )}

        {/* 금액 분배 */}
        {isMealCategory && selectedParticipants.length > 1 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>💰 금액 분배</Typography>
                <Box>
                  <Chip
                    label="균등분할"
                    size="small"
                    color={splitMode === 'equal' ? 'primary' : 'default'}
                    onClick={() => { setSplitMode('equal'); recalcAmounts(); }}
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label="직접입력"
                    size="small"
                    color={splitMode === 'custom' ? 'primary' : 'default'}
                    onClick={() => setSplitMode('custom')}
                  />
                </Box>
              </Box>

              {selectedParticipants.map((uid) => {
                const u = allUsers.find((u) => u.user_id === uid);
                const isMe = uid === me?.user_id;
                return (
                  <Box key={uid} display="flex" alignItems="center" gap={1.5} mb={1.5}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: isMe ? 'primary.main' : 'grey.400' }}>
                      {u?.name?.[0] || (me?.user_id === uid ? me?.name?.[0] : uid[0])}
                    </Avatar>
                    <Typography flex={1} variant="body2">
                      {u?.name || (isMe ? me?.name : uid)}
                      {isMe && ' (나)'}
                    </Typography>
                    <TextField
                      value={amounts[uid] || 0}
                      onChange={(e) => {
                        setSplitMode('custom');
                        setAmounts((prev) => ({ ...prev, [uid]: parseFloat(e.target.value) || 0 }));
                      }}
                      type="number"
                      size="small"
                      sx={{ width: 120 }}
                      InputProps={{ startAdornment: <Typography variant="caption" mr={0.5}>₩</Typography> }}
                    />
                  </Box>
                );
              })}

              <Divider sx={{ my: 1 }} />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">합계</Typography>
                <Typography variant="body2" fontWeight={600}>
                  ₩{Object.values(amounts).reduce((a, b) => a + b, 0).toLocaleString()}
                  {' / '}₩{(parseFloat(totalAmount) || 0).toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
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
