/**
 * 카드 선택 컴포넌트
 * - 등록된 카드가 있으면 Select로 선택 (주 카드 자동 선택)
 * - AI 추출 card_last4가 일치하는 카드가 있으면 해당 카드 우선 선택
 * - 등록된 카드가 없으면 직접 입력 TextField
 */
import React, { useEffect, useState } from 'react';
import {
  Box, FormControl, InputLabel, Select, MenuItem,
  TextField, Typography, Chip,
} from '@mui/material';
import { CreditCard, Star } from '@mui/icons-material';
import { cardsApi } from '../api/client';
import type { Card } from '../types';

interface CardSelectorProps {
  value: string;
  onChange: (last4: string) => void;
  extractedLast4?: string | null;
}

const CardSelector: React.FC<CardSelectorProps> = ({ value, onChange, extractedLast4 }) => {
  const [myCards, setMyCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    cardsApi.list().then((res) => {
      const cards: Card[] = res.data.cards || [];
      // 주 카드 우선 정렬
      cards.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
      setMyCards(cards);

      // 자동 선택: AI 추출값과 일치하는 카드 → 주 카드 순
      if (!value) {
        const matchByExtracted = extractedLast4
          ? cards.find((c) => c.card_last4 === extractedLast4)
          : null;
        const primary = cards.find((c) => c.is_primary);
        const autoSelect = matchByExtracted || primary || cards[0];
        if (autoSelect) onChange(autoSelect.card_last4);
      }
    }).catch(() => {}).finally(() => setLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;

  // 등록된 카드가 없으면 직접 입력
  if (myCards.length === 0) {
    return (
      <TextField
        label="카드 뒷 4자리"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        margin="normal"
        inputProps={{ maxLength: 4 }}
        placeholder="없으면 생략"
      />
    );
  }

  // 등록된 카드 있으면 Select
  return (
    <Box sx={{ mt: 2, mb: 1 }}>
      <FormControl fullWidth>
        <InputLabel>카드 선택</InputLabel>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          label="카드 선택"
          renderValue={(v) => {
            const card = myCards.find((c) => c.card_last4 === v);
            if (!card) return `****${v}`;
            return (
              <Box display="flex" alignItems="center" gap={1}>
                <CreditCard fontSize="small" />
                <span>{card.card_name} (****{card.card_last4})</span>
                {card.is_primary && (
                  <Chip label="주" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
              </Box>
            );
          }}
        >
          {myCards.map((card) => (
            <MenuItem key={card.card_id} value={card.card_last4}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <CreditCard fontSize="small" color="action" />
                <Box flex={1}>
                  <Typography variant="body2" fontWeight={card.is_primary ? 700 : 400}>
                    {card.card_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ****{card.card_last4}
                    {card.monthly_limit > 0 && ` · 한도 ₩${card.monthly_limit.toLocaleString()}`}
                  </Typography>
                </Box>
                {card.is_primary && (
                  <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                )}
                {extractedLast4 && card.card_last4 === extractedLast4 && (
                  <Chip label="AI인식" size="small" color="info" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
              </Box>
            </MenuItem>
          ))}
          <MenuItem value="">
            <Typography variant="body2" color="text.secondary">직접 입력</Typography>
          </MenuItem>
        </Select>
      </FormControl>

      {/* 직접 입력 선택 시 텍스트 필드 */}
      {value === '' && (
        <TextField
          label="카드 뒷 4자리 직접 입력"
          onChange={(e) => onChange(e.target.value)}
          fullWidth
          margin="normal"
          inputProps={{ maxLength: 4 }}
          autoFocus
        />
      )}
    </Box>
  );
};

export default CardSelector;
