import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Skeleton,
  Table, TableBody, TableCell, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, Button,
  Alert, Chip, LinearProgress, Tooltip,
} from '@mui/material';
import {
  Assessment, People, ReceiptLong, TrendingUp, PersonAdd,
  Person, ArrowForwardIos,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { adminApi } from '../../api/client';

interface UserSummary {
  user_id: string;
  name: string;
  department: string;
  amount: number;
  count: number;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [ym, setYm] = useState(format(new Date(), 'yyyy-MM'));
  const [dailyData, setDailyData] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersSummary, setUsersSummary] = useState<UserSummary[]>([]);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setSummaryLoading(true);
      try {
        const [daily, users] = await Promise.all([
          adminApi.dailyReport(ym),
          adminApi.listUsers(),
        ]);
        setDailyData(daily.data);
        setAllUsers(users.data.users);
      } finally {
        setLoading(false);
      }

      try {
        const summary = await adminApi.usersSummary(ym);
        setUsersSummary(summary.data.users || []);
        setSummaryTotal(summary.data.total || 0);
      } finally {
        setSummaryLoading(false);
      }
    };
    load();
  }, [ym]);

  const stats = [
    {
      label: '이번달 총 사용금액',
      value: `₩${(dailyData?.monthly_total || 0).toLocaleString()}`,
      icon: <TrendingUp />, color: '#1976d2',
    },
    {
      label: '총 사용 건수',
      value: `${dailyData?.daily?.reduce((s: number, d: any) => s + d.count, 0) || 0}건`,
      icon: <ReceiptLong />, color: '#388e3c',
    },
    {
      label: '활성 직원',
      value: `${allUsers.filter((u) => u.status === 'active' || (!u.status && u.is_active !== false)).length}명`,
      icon: <People />, color: '#f57c00',
    },
  ];

  const pendingCount = allUsers.filter((u) => u.status === 'pending').length;
  const maxAmount = usersSummary[0]?.amount || 1;

  // 년월 선택 옵션: 최근 6개월
  const ymOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, 'yyyy-MM');
  });

  return (
    <Layout title="관리자 대시보드" showBack>
      <Box sx={{ p: 2 }}>
        {/* 년월 선택 */}
        <Box display="flex" gap={1.5} mb={2} alignItems="center">
          <FormControl size="small">
            <InputLabel>년월</InputLabel>
            <Select value={ym} onChange={(e) => setYm(e.target.value)} label="년월" sx={{ minWidth: 130 }}>
              {ymOptions.map((val) => (
                <MenuItem key={val} value={val}>{val}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            {ym} 사용 현황
          </Typography>
        </Box>

        {/* 요약 카드 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ color: stat.color, fontSize: 36, display: 'flex' }}>{stat.icon}</Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                  {loading ? (
                    <Skeleton width={120} />
                  ) : (
                    <Typography variant="h6" fontWeight={700}>{stat.value}</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* 승인 대기 알림 */}
        {!loading && pendingCount > 0 && (
          <Alert
            severity="warning"
            icon={<PersonAdd />}
            sx={{ mb: 2, cursor: 'pointer' }}
            onClick={() => navigate('/admin/users')}
            action={
              <Button size="small" color="inherit" onClick={() => navigate('/admin/users')}>
                확인
              </Button>
            }
          >
            승인 대기 중인 계정이 <strong>{pendingCount}개</strong> 있습니다.
          </Alert>
        )}

        {/* 빠른 이동 */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <Button variant="outlined" fullWidth onClick={() => navigate('/admin/users')}>
            사용자 관리
          </Button>
          <Button variant="outlined" fullWidth onClick={() => navigate('/admin/records')}>
            전체 내역 조회
          </Button>
        </Box>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            직원별 식대 현황 (참여자 기준 개인 부담액)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            👤 직원별 식대 현황
          </Typography>
          <Typography variant="caption" color="text.secondary">
            참여자 기준 개인 부담액
          </Typography>
        </Box>

        <Card sx={{ mb: 2 }}>
          {summaryLoading ? (
            <Box sx={{ p: 2 }}>
              {[...Array(4)].map((_, i) => (
                <Box key={i} mb={1.5}>
                  <Skeleton height={20} width="60%" />
                  <Skeleton height={8} sx={{ mt: 0.5 }} />
                </Box>
              ))}
            </Box>
          ) : usersSummary.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">이번 달 식대 내역이 없습니다.</Typography>
            </Box>
          ) : (
            <>
              {/* 합계 헤더 */}
              <Box sx={{ px: 2, py: 1.5, bgcolor: 'primary.main', color: 'white', borderRadius: '4px 4px 0 0' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {ym} 총 식대 합계
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ₩{summaryTotal.toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              {/* 직원 목록 */}
              <Box sx={{ p: 1.5 }}>
                {usersSummary.map((u, idx) => {
                  const pct = summaryTotal > 0 ? (u.amount / summaryTotal) * 100 : 0;
                  const barPct = (u.amount / maxAmount) * 100;
                  return (
                    <Box
                      key={u.user_id}
                      sx={{
                        mb: idx < usersSummary.length - 1 ? 1.5 : 0,
                        p: 1.2,
                        borderRadius: 1,
                        bgcolor: 'grey.50',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => navigate(`/admin/records?user_id=${u.user_id}&year_month=${ym}`)}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Person sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                              {u.name || u.user_id}
                            </Typography>
                            {u.department && (
                              <Typography variant="caption" color="text.secondary" lineHeight={1}>
                                {u.department}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box textAlign="right" display="flex" alignItems="center" gap={1}>
                          <Box textAlign="right">
                            <Typography variant="body2" fontWeight={700} color="primary.main">
                              ₩{Math.round(u.amount).toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {u.count}건 · {pct.toFixed(1)}%
                            </Typography>
                          </Box>
                          <ArrowForwardIos sx={{ fontSize: 12, color: 'text.disabled' }} />
                        </Box>
                      </Box>
                      <Tooltip title={`₩${Math.round(u.amount).toLocaleString()} (전체의 ${pct.toFixed(1)}%)`} arrow>
                        <LinearProgress
                          variant="determinate"
                          value={barPct}
                          sx={{
                            height: 5,
                            borderRadius: 2,
                            bgcolor: 'grey.200',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: idx === 0 ? 'primary.main' : idx === 1 ? 'secondary.main' : 'grey.400',
                            },
                          }}
                        />
                      </Tooltip>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Card>

        {/* ━━━━━━━━━━━━━━━━━━━━
            일별 사용 현황
        ━━━━━━━━━━━━━━━━━━━━ */}
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          📅 일별 사용 현황
        </Typography>
        <Card>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>날짜</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>건수</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>금액</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                  </TableRow>
                ))
              ) : dailyData?.daily?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">데이터가 없습니다.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (dailyData?.daily || []).slice().reverse().map((d: any) => (
                  <TableRow key={d.date} hover>
                    <TableCell>{d.date}</TableCell>
                    <TableCell align="right">
                      <Chip label={`${d.count}건`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      ₩{Math.round(d.total).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Box>
    </Layout>
  );
};

export default AdminDashboard;
