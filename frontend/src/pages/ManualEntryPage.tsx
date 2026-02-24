import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, TextField, Typography, Button,
  Chip, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, ListItemAvatar, ListItemSecondaryAction,
  IconButton, Divider, Avatar, Checkbox, Tooltip,
  CircularProgress, Alert, InputAdornment,
} from '@mui/material';
import { Save, Star, StarBorder, Add, Delete } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import type { Category } from '../types';
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
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().slice(0, 16).replace('T', ' ')
  );
  const [cardLast4, setCardLast4] = useState('');
  const [memo, setMemo] = useState('');

  // 주문 세부 내역
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);

  // 참여자 (식사 카테고리)
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isMealCategory = MEAL_CATEGORIES.includes(category);

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

    setSaving(true);
    setError('');

    const participants = isMealCategory
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
        transaction_date: transactionDate || new Date().toISOString().slice(0, 16).replace('T', ' '),
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

  const favoriteUsers = allUsers.filter((u) => u.is_favorite && u.user_id !== me?.user_id);
  const otherUsers = allUsers.filter((u) => !u.is_favorite && u.user_id !== me?.user_id);

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
                      placeholder={isMealCategory ? '예: 삼겹살' : '예: A4용지'}
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

        {/* 참여자 (식사 카테고리만) */}
        {isMealCategory && (
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                👥 함께한 사람
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                ⭐ 별표로 즐겨찾기 · 체크로 이번 식사 참여자 선택
              </Typography>

              {me && (
                <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5, px: 0.5, bgcolor: 'action.hover', borderRadius: 1, mb: 1 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'primary.main', mr: 1.5 }}>
                    {me.name?.[0]}
                  </Avatar>
                  <Typography variant="body2" flex={1} fontWeight={600}>{me.name} (나)</Typography>
                  <Checkbox checked size="small" disabled />
                </Box>
              )}

              {favoriteUsers.length > 0 && (
                <>
                  <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ display: 'block', mt: 1, mb: 0.5 }}>
                    ⭐ 즐겨찾기
                  </Typography>
                  <List dense disablePadding>
                    {favoriteUsers.map((u) => (
                      <ListItem key={u.user_id} disablePadding sx={{ py: 0.2, cursor: 'pointer' }} onClick={() => toggleParticipant(u.user_id)}>
                        <Checkbox checked={selectedParticipants.includes(u.user_id)} size="small" sx={{ p: 0.5 }} />
                        <ListItemAvatar sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'warning.light' }}>{u.name[0]}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={u.name} secondary={u.department}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="즐겨찾기 해제">
                            <IconButton size="small" onClick={(e) => toggleFavorite(u.user_id, e)} disabled={favoriteLoading === u.user_id}>
                              {favoriteLoading === u.user_id ? <CircularProgress size={16} /> : <Star sx={{ color: 'warning.main', fontSize: 20 }} />}
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {otherUsers.length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.5 }}>전체 직원</Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <List dense disablePadding>
                      {otherUsers.map((u) => (
                        <ListItem key={u.user_id} disablePadding sx={{ py: 0.2, cursor: 'pointer' }} onClick={() => toggleParticipant(u.user_id)}>
                          <Checkbox checked={selectedParticipants.includes(u.user_id)} size="small" sx={{ p: 0.5 }} />
                          <ListItemAvatar sx={{ minWidth: 36 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 13 }}>{u.name[0]}</Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={u.name} secondary={u.department}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                          <ListItemSecondaryAction>
                            <Tooltip title="즐겨찾기 추가">
                              <IconButton size="small" onClick={(e) => toggleFavorite(u.user_id, e)} disabled={favoriteLoading === u.user_id}>
                                {favoriteLoading === u.user_id ? <CircularProgress size={16} /> : <StarBorder sx={{ fontSize: 20, color: 'text.disabled' }} />}
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
                        key={uid} label={u?.name || (isMe ? me?.name : uid)}
                        size="small" color="primary" variant="filled"
                        onDelete={isMe ? undefined : () => toggleParticipant(uid)}
                      />
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* 금액 분배 (식사 + 2명 이상) */}
        {isMealCategory && selectedParticipants.length > 1 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>💰 금액 분배</Typography>
                <Box>
                  <Chip label="균등분할" size="small" color={splitMode === 'equal' ? 'primary' : 'default'}
                    onClick={() => setSplitMode('equal')} sx={{ mr: 1 }} />
                  <Chip label="직접입력" size="small" color={splitMode === 'custom' ? 'primary' : 'default'}
                    onClick={() => setSplitMode('custom')} />
                </Box>
              </Box>

              {selectedParticipants.map((uid) => {
                const u = allUsers.find((u) => u.user_id === uid);
                const isMe = uid === me?.user_id;
                return (
                  <Box key={uid} display="flex" alignItems="center" gap={1.5} mb={1.5}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: isMe ? 'primary.main' : 'grey.400' }}>
                      {u?.name?.[0] || (isMe ? me?.name?.[0] : uid[0])}
                    </Avatar>
                    <Typography flex={1} variant="body2">
                      {u?.name || (isMe ? me?.name : uid)}{isMe && ' (나)'}
                    </Typography>
                    <TextField
                      value={amounts[uid] || 0}
                      onChange={(e) => {
                        setSplitMode('custom');
                        setAmounts((prev) => ({ ...prev, [uid]: parseFloat(e.target.value) || 0 }));
                      }}
                      type="number" size="small" sx={{ width: 120 }}
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
