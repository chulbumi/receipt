import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Chip, Divider, Skeleton,
  Select, MenuItem, FormControl, InputLabel, TextField,
  Fab, Alert, IconButton,
} from '@mui/material';
import { Add, FilterList } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import { recordsApi } from '../api/client';
import { CATEGORY_LABELS, CATEGORY_ICONS, type ReceiptRecord, type Category } from '../types';

const CATEGORIES = ['', ...Object.keys(CATEGORY_LABELS)] as ('' | Category)[];

const RecordListPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [category, setCategory] = useState<'' | Category>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await recordsApi.getMyRecords({
        year_month: yearMonth || undefined,
        category: category || undefined,
      });
      setRecords(res.data.records);
    } catch {
      setError('내역을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [yearMonth, category]);

  useEffect(() => { load(); }, [load]);

  const total = records.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  return (
    <Layout title="사용 내역">
      <Box sx={{ p: 2 }}>
        {/* 필터 */}
        <Box display="flex" gap={1.5} mb={2}>
          <TextField
            label="년월"
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>카테고리</InputLabel>
            <Select value={category} onChange={(e) => setCategory(e.target.value as '' | Category)} label="카테고리">
              <MenuItem value="">전체</MenuItem>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* 합계 */}
        <Card sx={{ mb: 2, bgcolor: 'primary.main', color: 'white', p: 2 }}>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {yearMonth} 합계 ({records.length}건)
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            ₩{total.toLocaleString()}
          </Typography>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 목록 */}
        <Card>
          {loading ? (
            [...Array(5)].map((_, i) => (
              <Box key={i} sx={{ p: 2 }}>
                <Skeleton variant="text" />
                <Skeleton variant="text" width="60%" />
              </Box>
            ))
          ) : records.length === 0 ? (
            <Box textAlign="center" py={5}>
              <Typography color="text.secondary">내역이 없습니다.</Typography>
            </Box>
          ) : (
            records.map((rec, idx) => (
              <React.Fragment key={rec.record_id}>
                <Box
                  sx={{ px: 2, py: 1.8, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => navigate(`/records/${rec.record_id}`)}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Typography fontSize={24}>{CATEGORY_ICONS[rec.category]}</Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {rec.store_name || CATEGORY_LABELS[rec.category]}
                        </Typography>
                        <Box display="flex" gap={0.5} alignItems="center" mt={0.3}>
                          <Typography variant="caption" color="text.secondary">
                            {rec.transaction_date?.slice(0, 16)}
                          </Typography>
                          {rec.participants?.length > 1 && (
                            <Chip label={`${rec.participants.length}명`} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        ₩{rec.total_amount?.toLocaleString()}
                      </Typography>
                      <Chip
                        label={CATEGORY_LABELS[rec.category]}
                        size="small"
                        sx={{ fontSize: '0.6rem', height: 18, mt: 0.3 }}
                      />
                    </Box>
                  </Box>
                </Box>
                {idx < records.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </Card>
      </Box>

      <Fab
        color="primary"
        onClick={() => navigate('/capture')}
        sx={{ position: 'fixed', bottom: 80, right: 16 }}
      >
        <Add />
      </Fab>
    </Layout>
  );
};

export default RecordListPage;
