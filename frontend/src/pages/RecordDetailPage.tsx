import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Button,
  List, ListItem, ListItemText, Divider, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Avatar,
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { recordsApi } from '../api/client';
import { CATEGORY_LABELS, CATEGORY_ICONS, type ReceiptRecord } from '../types';
import { useAuth } from '../auth/AuthContext';

const RecordDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [record, setRecord] = useState<ReceiptRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    recordsApi.getOne(id)
      .then((res) => setRecord(res.data))
      .catch(() => setError('내역을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await recordsApi.delete(id);
      navigate('/records', { replace: true });
    } catch {
      setError('삭제에 실패했습니다.');
      setDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout title="사용 내역 상세" showBack>
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (error || !record) {
    return (
      <Layout title="사용 내역 상세" showBack>
        <Box p={2}>
          <Alert severity="error">{error || '내역을 찾을 수 없습니다.'}</Alert>
        </Box>
      </Layout>
    );
  }

  const canEdit = record.registered_by === me?.user_id || me?.role === 'admin';

  return (
    <Layout
      title="사용 내역 상세"
      showBack
      rightElement={
        canEdit ? (
          <Button color="error" size="small" startIcon={<Delete />} onClick={() => setDeleteDialog(true)}>
            삭제
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ p: 2, pb: 4 }}>
        {/* 영수증 이미지 */}
        {record.image_url && (
          <Card sx={{ mb: 2 }}>
            <img src={record.image_url} alt="영수증" style={{ width: '100%', maxHeight: 350, objectFit: 'contain', display: 'block' }} />
          </Card>
        )}

        {/* 기본 정보 */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1.5} mb={2}>
              <Typography fontSize={36}>{CATEGORY_ICONS[record.category]}</Typography>
              <Box>
                <Typography variant="h6" fontWeight={700}>{record.store_name || CATEGORY_LABELS[record.category]}</Typography>
                <Chip label={CATEGORY_LABELS[record.category]} size="small" color="primary" />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">결제금액</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  ₩{record.total_amount?.toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">사용일시</Typography>
                <Typography variant="body2" fontWeight={600}>{record.transaction_date?.slice(0, 16)}</Typography>
              </Box>
              {record.approval_number && (
                <Box>
                  <Typography variant="caption" color="text.secondary">승인번호</Typography>
                  <Typography variant="body2">{record.approval_number}</Typography>
                </Box>
              )}
              {record.card_last4 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">카드</Typography>
                  <Typography variant="body2">****{record.card_last4}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">등록자</Typography>
                <Typography variant="body2">{record.registered_by_name}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">등록일시</Typography>
                <Typography variant="body2">{record.created_at?.slice(0, 16).replace('T', ' ')}</Typography>
              </Box>
            </Box>

            {record.memo && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">메모</Typography>
                <Typography variant="body2">{record.memo}</Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* 참여자 */}
        {record.participants?.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                👥 참여자 ({record.participants.length}명)
              </Typography>
              {record.participants.map((p, i) => (
                <React.Fragment key={p.user_id}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" py={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
                        {p.name?.[0]}
                      </Avatar>
                      <Typography variant="body2">{p.name}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      ₩{p.amount?.toLocaleString()}
                    </Typography>
                  </Box>
                  {i < record.participants.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 주문내역 */}
        {record.order_details?.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>🧾 주문내역</Typography>
              {record.order_details.map((od, i) => (
                <Box key={i} display="flex" justifyContent="space-between" py={0.8}>
                  <Typography variant="body2">{od.item} × {od.quantity}</Typography>
                  <Typography variant="body2">₩{od.price?.toLocaleString()}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        )}
      </Box>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>내역 삭제</DialogTitle>
        <DialogContent>
          <Typography>정말 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)} disabled={deleting}>취소</Button>
          <Button color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default RecordDetailPage;
