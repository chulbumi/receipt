import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Fab, Alert, CircularProgress,
} from '@mui/material';
import { Add, Delete, CreditCard } from '@mui/icons-material';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import { cardsApi } from '../api/client';
import { type Card as CardType } from '../types';

interface CardSummary {
  card_id: string;
  user_id: string;
  card_name: string;
  card_last4: string;
  monthly_limit: number;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ym = format(new Date(), 'yyyy-MM');

  const loadCards = async () => {
    setLoading(true);
    try {
      const res = await cardsApi.list();
      const cardList: CardType[] = res.data.cards;
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
      });
      setAddDialog(false);
      setCardName('');
      setCardLast4('');
      setMonthlyLimit('');
      setError('');
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
              <Card key={card.card_id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <CreditCard color="primary" />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>{card.card_name}</Typography>
                        <Typography variant="caption" color="text.secondary">****{card.card_last4}</Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" color="error" onClick={() => handleDelete(card.card_id)}>
                      <Delete fontSize="small" />
                    </IconButton>
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
            <TextField label="카드 별칭" value={cardName} onChange={(e) => setCardName(e.target.value)} fullWidth margin="normal" />
            <TextField label="카드 뒷 4자리" value={cardLast4} onChange={(e) => setCardLast4(e.target.value)} fullWidth margin="normal" inputProps={{ maxLength: 4 }} />
            <TextField label="월 한도 (원, 없으면 0)" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} type="number" fullWidth margin="normal" />
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
