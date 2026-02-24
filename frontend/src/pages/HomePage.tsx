import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button,
  Chip, Divider, Skeleton, Avatar,
} from '@mui/material';
import {
  AddCircle, ListAlt, CalendarMonth, CreditCard,
  TrendingUp, ReceiptLong,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { recordsApi } from '../api/client';
import type { ReceiptRecord } from '../types';
import { useCategories } from '../contexts/CategoriesContext';

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { labelOf, iconOf } = useCategories();
  const [monthlyTotal, setMonthlyTotal] = useState<number | null>(null);
  const [recentRecords, setRecentRecords] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYM = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    const load = async () => {
      try {
        const [calRes, recRes] = await Promise.all([
          recordsApi.getCalendar(currentYM),
          recordsApi.getMyRecords({ limit: 5 }),
        ]);
        setMonthlyTotal(calRes.data.monthly_total);
        setRecentRecords(recRes.data.records);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const quickActions = [
    { label: '영수증 등록', icon: <AddCircle />, path: '/capture', color: '#1976d2' },
    { label: '사용 내역', icon: <ListAlt />, path: '/records', color: '#388e3c' },
    { label: '달력 보기', icon: <CalendarMonth />, path: '/calendar', color: '#f57c00' },
    { label: '법인카드', icon: <CreditCard />, path: '/cards', color: '#7b1fa2' },
  ];

  return (
    <Layout>
      <Box sx={{ p: 2 }}>
        {/* 인사 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 1.5 }}>
            {user?.name?.[0]}
          </Avatar>
          <Box>
            <Typography variant="body2" color="text.secondary">안녕하세요</Typography>
            <Typography variant="subtitle1" fontWeight={600}>{user?.name}님</Typography>
          </Box>
        </Box>

        {/* 이번달 누적 사용금액 */}
        <Card sx={{ mb: 2, background: 'linear-gradient(135deg, #1976d2, #42a5f5)', color: 'white' }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
              <TrendingUp sx={{ mr: 1 }} />
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {format(new Date(), 'M월', { locale: ko })} 누적 사용금액
              </Typography>
            </Box>
            {loading ? (
              <Skeleton variant="text" width={150} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
            ) : (
              <Typography variant="h4" fontWeight={700}>
                {monthlyTotal !== null
                  ? `₩${monthlyTotal.toLocaleString()}`
                  : '₩0'}
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* 퀵 액션 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
          {quickActions.map((action) => (
            <Card
              key={action.path}
              onClick={() => navigate(action.path)}
              sx={{ cursor: 'pointer', '&:active': { opacity: 0.8 }, transition: 'opacity 0.1s' }}
            >
              <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                <Box sx={{ color: action.color, mb: 1 }}>
                  {React.cloneElement(action.icon, { sx: { fontSize: 32 } })}
                </Box>
                <Typography variant="body2" fontWeight={600}>
                  {action.label}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* 최근 사용내역 */}
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          최근 사용내역
        </Typography>
        <Card>
          {loading ? (
            [...Array(3)].map((_, i) => (
              <Box key={i} sx={{ p: 2 }}>
                <Skeleton variant="text" />
                <Skeleton variant="text" width="60%" />
              </Box>
            ))
          ) : recentRecords.length === 0 ? (
            <CardContent>
              <Box textAlign="center" py={3}>
                <ReceiptLong sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">아직 등록된 내역이 없습니다.</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddCircle />}
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/capture')}
                >
                  첫 영수증 등록하기
                </Button>
              </Box>
            </CardContent>
          ) : (
            recentRecords.map((rec, idx) => (
              <React.Fragment key={rec.record_id}>
                <Box
                  sx={{ px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => navigate(`/records/${rec.record_id}`)}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography fontSize={20}>
                        {iconOf(rec.category)}
                      </Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {rec.store_name || labelOf(rec.category)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rec.transaction_date?.slice(0, 10)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        ₩{rec.total_amount.toLocaleString()}
                      </Typography>
                      <Chip
                        label={labelOf(rec.category)}
                        size="small"
                        sx={{ fontSize: '0.6rem', height: 18 }}
                      />
                    </Box>
                  </Box>
                </Box>
                {idx < recentRecords.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
          {recentRecords.length > 0 && (
            <Box textAlign="center" py={1}>
              <Button size="small" onClick={() => navigate('/records')}>전체 보기</Button>
            </Box>
          )}
        </Card>
      </Box>
    </Layout>
  );
};

export default HomePage;
