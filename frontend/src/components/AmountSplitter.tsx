import React, { useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Divider,
  Chip, ToggleButton, ToggleButtonGroup, IconButton, InputBase,
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { useAuth } from '../auth/AuthContext';

interface Participant {
  user_id: string;
  name: string;
}

interface AmountSplitterProps {
  participants: Participant[];
  amounts: Record<string, number>;
  totalAmount: number;
  splitMode: 'equal' | 'custom';
  onSplitModeChange: (mode: 'equal' | 'custom') => void;
  onAmountChange: (uid: string, value: number) => void;
}

type StepUnit = 1000 | 500 | 100;

const AmountSplitter: React.FC<AmountSplitterProps> = ({
  participants,
  amounts,
  totalAmount,
  splitMode,
  onSplitModeChange,
  onAmountChange,
}) => {
  const { user: me } = useAuth();
  const [stepUnit, setStepUnit] = useState<StepUnit>(1000);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const splitTotal = Object.values(amounts).reduce((a, b) => a + b, 0);
  const isBalanced = splitTotal === totalAmount;
  const diff = splitTotal - totalAmount;

  const handleStep = (uid: string, direction: 1 | -1) => {
    const current = amounts[uid] || 0;
    const next = current + direction * stepUnit;
    if (next < 0) return;
    onSplitModeChange('custom');
    onAmountChange(uid, next);
  };

  const handleStepUnitChange = (_: React.MouseEvent<HTMLElement>, value: StepUnit | null) => {
    if (value !== null) setStepUnit(value);
  };

  const startEdit = (uid: string, currentAmount: number) => {
    setEditingUid(uid);
    setEditValue(currentAmount === 0 ? '' : String(currentAmount));
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  };

  const commitEdit = (uid: string) => {
    const parsed = parseInt(editValue.replace(/,/g, ''), 10);
    const value = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    onSplitModeChange('custom');
    onAmountChange(uid, value);
    setEditingUid(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, uid: string) => {
    if (e.key === 'Enter') commitEdit(uid);
    if (e.key === 'Escape') {
      setEditingUid(null);
      setEditValue('');
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {/* 헤더 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="subtitle1" fontWeight={600}>💰 금액 분배</Typography>
          <Box display="flex" gap={0.5}>
            <Chip
              label="균등분할"
              size="small"
              color={splitMode === 'equal' ? 'primary' : 'default'}
              onClick={() => onSplitModeChange('equal')}
            />
            <Chip
              label="직접입력"
              size="small"
              color={splitMode === 'custom' ? 'primary' : 'default'}
              onClick={() => onSplitModeChange('custom')}
            />
          </Box>
        </Box>

        {/* 단위 토글 */}
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Typography variant="caption" color="text.secondary">증감 단위:</Typography>
          <ToggleButtonGroup
            value={stepUnit}
            exclusive
            onChange={handleStepUnitChange}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value={1000} sx={{ px: 1.5, fontSize: '0.75rem', fontWeight: 600 }}>
              1,000
            </ToggleButton>
            <ToggleButton value={500} sx={{ px: 1.5, fontSize: '0.75rem', fontWeight: 600 }}>
              500
            </ToggleButton>
            <ToggleButton value={100} sx={{ px: 1.5, fontSize: '0.75rem', fontWeight: 600 }}>
              100
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">원</Typography>
        </Box>

        {/* 참여자별 금액 */}
        {participants.map((p) => {
          const isMe = p.user_id === me?.user_id;
          const amount = amounts[p.user_id] || 0;
          const isEditing = editingUid === p.user_id;

          return (
            <Box key={p.user_id} display="flex" alignItems="center" gap={1} mb={1.5}>
              <Avatar
                sx={{
                  width: 32, height: 32, fontSize: 14,
                  bgcolor: isMe ? 'primary.main' : 'grey.400',
                  flexShrink: 0,
                }}
              >
                {p.name?.[0]}
              </Avatar>

              <Typography flex={1} variant="body2" noWrap>
                {p.name}{isMe && ' (나)'}
              </Typography>

              {/* - 버튼 */}
              <IconButton
                size="small"
                onClick={() => handleStep(p.user_id, -1)}
                disabled={amount <= 0}
                sx={{ width: 28, height: 28, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
              >
                <Remove fontSize="small" />
              </IconButton>

              {/* 금액 — 클릭 시 직접 입력 */}
              <Box
                onClick={() => !isEditing && startEdit(p.user_id, amount)}
                sx={{
                  minWidth: 90,
                  textAlign: 'center',
                  py: 0.5,
                  px: 1,
                  border: '1px solid',
                  borderColor: isEditing ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  cursor: isEditing ? 'text' : 'pointer',
                  boxShadow: isEditing ? '0 0 0 2px rgba(25,118,210,0.2)' : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  '&:hover': { borderColor: isEditing ? 'primary.main' : 'text.secondary' },
                }}
              >
                {isEditing ? (
                  <InputBase
                    inputRef={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(p.user_id)}
                    onKeyDown={(e) => handleKeyDown(e, p.user_id)}
                    inputProps={{
                      inputMode: 'numeric',
                      style: {
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        padding: 0,
                        width: '100%',
                      },
                    }}
                    sx={{ width: '100%' }}
                    autoFocus
                  />
                ) : (
                  <Typography variant="body2" fontWeight={600}>
                    ₩{amount.toLocaleString()}
                  </Typography>
                )}
              </Box>

              {/* + 버튼 */}
              <IconButton
                size="small"
                onClick={() => handleStep(p.user_id, 1)}
                sx={{ width: 28, height: 28, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
              >
                <Add fontSize="small" />
              </IconButton>
            </Box>
          );
        })}

        <Divider sx={{ my: 1 }} />

        {/* 합계 */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">분배 합계</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            {!isBalanced && (
              <Typography variant="caption" color={diff > 0 ? 'error' : 'warning.main'}>
                {diff > 0 ? `+${diff.toLocaleString()}원 초과` : `${Math.abs(diff).toLocaleString()}원 부족`}
              </Typography>
            )}
            <Typography
              variant="body2"
              fontWeight={600}
              color={isBalanced ? 'success.main' : 'error'}
            >
              ₩{splitTotal.toLocaleString()} / ₩{totalAmount.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {!isBalanced && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, textAlign: 'right' }}>
            합계가 결제금액과 일치해야 등록할 수 있습니다.
          </Typography>
        )}

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          금액을 탭하면 직접 입력할 수 있습니다
        </Typography>
      </CardContent>
    </Card>
  );
};

export default AmountSplitter;
