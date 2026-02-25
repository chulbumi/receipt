import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, IconButton,
  Skeleton, Chip, Divider,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { recordsApi } from '../api/client';
import type { ReceiptRecord } from '../types';
import { useCategories } from '../contexts/CategoriesContext';

interface DayData {
  date: string;
  total: number;
  count: number;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const CalendarPage: React.FC = () => {
  const { labelOf, iconOf } = useCategories();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calData, setCalData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayRecords, setDayRecords] = useState<ReceiptRecord[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const ym = format(currentDate, 'yyyy-MM');

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recordsApi.getCalendar(ym);
      setCalData(res.data.daily || []);
    } catch {
      setCalData([]);
    } finally {
      setLoading(false);
    }
  }, [ym]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const loadDayRecords = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setDayLoading(true);
    try {
      const res = await recordsApi.getMyRecords({ year_month: dateStr.slice(0, 7) });
      setDayRecords(res.data.records.filter((r: ReceiptRecord) => r.transaction_date?.startsWith(dateStr)));
    } finally {
      setDayLoading(false);
    }
  };

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const firstDay = startOfMonth(currentDate);
  const lastDay = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const startPad = getDay(firstDay);

  const getDayData = (date: Date) => calData.find((d) => d.date === format(date, 'yyyy-MM-dd'));
  const monthlyTotal = calData.reduce((sum, d) => sum + d.total, 0);

  return (
    <Layout title="달력 보기">
      <Box sx={{ p: 2 }}>
        {/* 월 네비게이션 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <IconButton onClick={prevMonth}><ChevronLeft /></IconButton>
          <Box textAlign="center">
            <Typography variant="h6" fontWeight={700}>
              {format(currentDate, 'yyyy년 M월', { locale: ko })}
            </Typography>
            {loading ? (
              <Skeleton width={100} />
            ) : (
              <Typography variant="body2" color="primary.main" fontWeight={600}>
                합계: ₩{monthlyTotal.toLocaleString()}
              </Typography>
            )}
          </Box>
          <IconButton onClick={nextMonth}><ChevronRight /></IconButton>
        </Box>

        {/* 요일 헤더 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {WEEKDAYS.map((d, i) => (
            <Typography
              key={d}
              variant="caption"
              textAlign="center"
              display="block"
              fontWeight={600}
              color={i === 0 ? 'error.main' : i === 6 ? 'primary.main' : 'text.secondary'}
            >
              {d}
            </Typography>
          ))}
        </Box>

        {/* 달력 그리드 */}
        <Card>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {/* 앞 빈 칸 */}
            {[...Array(startPad)].map((_, i) => (
              <Box key={`pad-${i}`} sx={{ borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', minHeight: 60 }} />
            ))}
            {days.map((date) => {
              const dayData = getDayData(date);
              const dateStr = format(date, 'yyyy-MM-dd');
              const isSelected = selectedDate === dateStr;
              const isToday = isSameDay(date, new Date());
              const dayOfWeek = getDay(date);

              return (
                <Box
                  key={dateStr}
                  onClick={() => loadDayRecords(dateStr)}
                  sx={{
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: '1px solid #f0f0f0',
                    minHeight: 60,
                    p: 0.5,
                    cursor: 'pointer',
                    bgcolor: isSelected ? 'rgba(25,118,210,0.08)' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    transition: 'background 0.15s',
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={isToday ? 700 : 400}
                    color={isToday ? 'white' : dayOfWeek === 0 ? 'error.main' : dayOfWeek === 6 ? 'primary.main' : 'text.primary'}
                    sx={isToday ? {
                      bgcolor: 'primary.main', borderRadius: '50%',
                      width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    } : {}}
                  >
                    {format(date, 'd')}
                  </Typography>
                  {dayData && !loading && (
                    <Typography variant="caption" display="block" color="primary.main" fontWeight={600} sx={{ fontSize: '0.58rem', lineHeight: 1.2 }}>
                      ₩{dayData.total >= 10000 ? `${(dayData.total / 10000).toFixed(0)}만` : dayData.total.toLocaleString()}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Card>

        {/* 선택된 날 내역 */}
        {selectedDate && (
          <Box mt={2}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {selectedDate} 사용내역
            </Typography>
            <Card>
              {dayLoading ? (
                <Box p={2}><Skeleton /><Skeleton width="60%" /></Box>
              ) : dayRecords.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <Typography color="text.secondary">사용 내역이 없습니다.</Typography>
                </Box>
              ) : (
                dayRecords.map((rec, idx) => (
                  <React.Fragment key={rec.record_id}>
                    <Box
                      sx={{ px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                      onClick={() => navigate(`/records/${rec.record_id}`)}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography fontSize={20}>{iconOf(rec.category)}</Typography>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {rec.store_name || labelOf(rec.category)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {rec.transaction_date?.slice(11, 16)}
                            </Typography>
                          </Box>
                        </Box>
                        <Box textAlign="right">
                          <Typography variant="body2" fontWeight={700} color="primary.main">
                            ₩{(rec.my_amount ?? rec.total_amount)?.toLocaleString()}
                          </Typography>
                          {rec.my_amount != null && rec.my_amount !== rec.total_amount && (
                            <Typography variant="caption" color="text.secondary">
                              합계 ₩{rec.total_amount?.toLocaleString()}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                    {idx < dayRecords.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              )}
            </Card>
          </Box>
        )}
      </Box>
    </Layout>
  );
};

export default CalendarPage;
