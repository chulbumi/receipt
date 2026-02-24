import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Fab, Alert, CircularProgress, Chip, Tooltip,
} from '@mui/material';
import { Add, Delete, CreditCard, Star, StarBorder } from '@mui/icons-material';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import { cardsApi } from '../api/client';
import { type Card as CardType } from '../types';

interface CardSummary extends CardType {
  used_amount?: number;
  remaining?: number;
}

const CardStatusPage: React.FC = () => {
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [error, setError] = useState('');

  const ym = format(new Date(), 'yyyy-MM');

  const loadCards = async () => {
    setLoading(true);
    try {
      const res = await cardsApi.list();
      const cardList: CardType[] = res.data.cards;
      // 주 카드 우선 정렬
      cardList.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
      const summaries = await Promise.all(
        cardList.map(async (card) => {
          try {
            const sumRes = await cardsApi.getSummary(card.card_id, ym);
            return { ...card, ...sumRes.data };
          } catch {
            return card;
          }
        })
      );
      setCards(summaries);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCards(); }, []);

  const handleAdd = async () => {
    if (!cardName || !cardLast4) {
      setError('카드 이름과 뒷 4자리를 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await cardsApi.create({
        card_name: cardName,
        card_last4: cardLast4,
        monthly_limit: parseFloat(monthlyLimit) || 0,
        is_primary: isPrimary,
      });
      setAddDialog(false);
      setCardName(''); setCardLast4(''); setMonthlyLimit(''); setIsPrimary(false); setError('');
      loadCards();
    } catch {
      setError('카드 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!window.confirm('카드를 삭제하시겠습니까?')) return;
    await cardsApi.delete(cardId);
    loadCards();
  };

  const handleSetPrimary = async (cardId: string) => {
    setSettingPrimary(cardId);
    try {
      await cardsApi.setPrimary(cardId);
      loadCards();
    } finally {
      setSettingPrimary(null);
    }
  };

  return (
    <Layout title="법인카드 현황">
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {ym} 사용 현황
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={5}><CircularProgress /></Box>
        ) : cards.length === 0 ? (
          <Card>
            <Box textAlign="center" py={5}>
              <CreditCard sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">등록된 법인카드가 없습니다.</Typography>
              <Button variant="contained" startIcon={<Add />} sx={{ mt: 2 }} onClick={() => setAddDialog(true)}>
                카드 등록
              </Button>
            </Box>
          </Card>
        ) : (
          cards.map((card) => {
            const used = card.used_amount || 0;
            const limit = card.monthly_limit || 0;
            const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

            return (
              <Card key={card.card_id} sx={{ mb: 2, border: card.is_primary ? '2px solid' : '1px solid', borderColor: card.is_primary ? 'primary.main' : 'divider' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <CreditCard color={card.is_primary ? 'primary' : 'action'} />
                      <Box>
                        <Box display="flex" alignItems="center" gap={0.8}>
                          <Typography variant="subtitle1" fontWeight={600}>{card.card_name}</Typography>
                          {card.is_primary && (
                            <Chip label="주 카드" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">****{card.card_last4}</Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {!card.is_primary && (
                        <Tooltip title="주 사용 카드로 설정">
                          <IconButton
                            size="small"
                            onClick={() => handleSetPrimary(card.card_id)}
                            disabled={settingPrimary === card.card_id}
                          >
                            {settingPrimary === card.card_id
                              ? <CircularProgress size={16} />
                              : <StarBorder fontSize="small" />
                            }
                          </IconButton>
                        </Tooltip>
                      )}
                      {card.is_primary && (
                        <Star sx={{ fontSize: 20, color: 'warning.main', mr: 0.5 }} />
                      )}
                      <IconButton size="small" color="error" onClick={() => handleDelete(card.card_id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">이번달 사용</Typography>
                      <Typography variant="h5" fontWeight={700} color="primary.main">
                        ₩{used.toLocaleString()}
                      </Typography>
                    </Box>
                    {limit > 0 && (
                      <Box textAlign="right">
                        <Typography variant="caption" color="text.secondary">한도</Typography>
                        <Typography variant="body1" fontWeight={600}>₩{limit.toLocaleString()}</Typography>
                        <Typography variant="caption" color={pct >= 90 ? 'error.main' : 'success.main'}>
                          잔여 ₩{(card.remaining || 0).toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {limit > 0 && (
                    <Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        color={pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'primary'}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                        {pct.toFixed(1)}% 사용
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        <Fab color="primary" onClick={() => setAddDialog(true)} sx={{ position: 'fixed', bottom: 80, right: 16 }}>
          <Add />
        </Fab>

        <Dialog open={addDialog} onClose={() => setAddDialog(false)} fullWidth>
          <DialogTitle>법인카드 등록</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField label="카드 별칭" value={cardName} onChange={(e) => setCardName(e.target.value)} fullWidth margin="normal" placeholder="예: 신한법인카드" />
            <TextField label="카드 뒷 4자리" value={cardLast4} onChange={(e) => setCardLast4(e.target.value)} fullWidth margin="normal" inputProps={{ maxLength: 4 }} />
            <TextField label="월 한도 (원, 없으면 0)" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} type="number" fullWidth margin="normal" />
            <Box
              sx={{ mt: 1, p: 1.5, border: '1px solid', borderColor: isPrimary ? 'primary.main' : 'divider', borderRadius: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}
              onClick={() => setIsPrimary((v) => !v)}
            >
              {isPrimary ? <Star sx={{ color: 'warning.main' }} /> : <StarBorder color="action" />}
              <Box>
                <Typography variant="body2" fontWeight={600}>주 사용 카드로 설정</Typography>
                <Typography variant="caption" color="text.secondary">영수증 등록 시 이 카드가 자동 선택됩니다</Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialog(false)}>취소</Button>
            <Button variant="contained" onClick={handleAdd} disabled={saving}>
              {saving ? <CircularProgress size={20} /> : '등록'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default CardStatusPage;
