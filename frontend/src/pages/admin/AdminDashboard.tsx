import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Skeleton,
  Table, TableBody, TableCell, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, Button,
} from '@mui/material';
import { Assessment, People, ReceiptLong, TrendingUp, PersonAdd } from '@mui/icons-material';
import { Alert } from '@mui/material';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { adminApi } from '../../api/client';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [ym, setYm] = useState(format(new Date(), 'yyyy-MM'));
  const [dailyData, setDailyData] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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

  return (
    <Layout title="관리자 대시보드" showBack>
      <Box sx={{ p: 2 }}>
        <Box display="flex" gap={1.5} mb={2} alignItems="center">
          <FormControl size="small">
            <InputLabel>년월</InputLabel>
            <Select value={ym} onChange={(e) => setYm(e.target.value)} label="년월" sx={{ minWidth: 120 }}>
              {[-2, -1, 0, 1].map((offset) => {
                const d = new Date();
                d.setMonth(d.getMonth() + offset);
                const val = format(d, 'yyyy-MM');
                return <MenuItem key={val} value={val}>{val}</MenuItem>;
              })}
            </Select>
          </FormControl>
        </Box>

        {/* 요약 카드 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                <Box sx={{ color: stat.color, fontSize: 36 }}>{stat.icon}</Box>
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

        {/* 일별 사용 현황 */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          일별 사용 현황
        </Typography>
        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>날짜</TableCell>
                <TableCell align="right">건수</TableCell>
                <TableCell align="right">금액</TableCell>
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
                  <TableRow key={d.date}>
                    <TableCell>{d.date}</TableCell>
                    <TableCell align="right">{d.count}건</TableCell>
                    <TableCell align="right">₩{d.total.toLocaleString()}</TableCell>
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
