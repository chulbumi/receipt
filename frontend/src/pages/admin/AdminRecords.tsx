import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Select, MenuItem, FormControl,
  InputLabel, TextField, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, CircularProgress, Alert,
} from '@mui/material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { adminApi } from '../../api/client';
import { useCategories } from '../../contexts/CategoriesContext';

const AdminRecords: React.FC = () => {
  const navigate = useNavigate();
  const { categories, labelOf } = useCategories();
  const [ym, setYm] = useState(format(new Date(), 'yyyy-MM'));
  const [category, setCategory] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listRecords({ year_month: ym, category: category || undefined });
      setRecords(res.data.records);
    } catch {
      setError('내역 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [ym, category]);

  useEffect(() => { load(); }, [load]);

  const total = records.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  return (
    <Layout title="전체 사용내역" showBack>
      <Box sx={{ p: 2 }}>
        <Box display="flex" gap={1.5} mb={2}>
          <TextField
            label="년월" type="month" value={ym}
            onChange={(e) => setYm(e.target.value)}
            size="small" sx={{ flex: 1 }} InputLabelProps={{ shrink: true }}
          />
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>카테고리</InputLabel>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} label="카테고리">
              <MenuItem value="">전체</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>{cat.icon} {cat.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Card sx={{ mb: 2, bgcolor: 'primary.main', color: 'white', p: 2 }}>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>합계 ({records.length}건)</Typography>
          <Typography variant="h5" fontWeight={700}>₩{total.toLocaleString()}</Typography>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>날짜</TableCell>
                <TableCell>등록자</TableCell>
                <TableCell>상호</TableCell>
                <TableCell>카테고리</TableCell>
                <TableCell align="right">금액</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">내역이 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              ) : records.map((rec) => (
                <TableRow
                  key={rec.record_id}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => navigate(`/records/${rec.record_id}`)}
                >
                  <TableCell sx={{ fontSize: '0.75rem' }}>{rec.transaction_date?.slice(0, 10)}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{rec.registered_by_name}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{rec.store_name || '-'}</TableCell>
                  <TableCell>
                    <Chip label={labelOf(rec.category)} size="small" sx={{ fontSize: '0.65rem' }} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    ₩{rec.total_amount?.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Box>
    </Layout>
  );
};

export default AdminRecords;
