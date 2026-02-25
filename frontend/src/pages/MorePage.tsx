import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, List, ListItemIcon, ListItemText,
  ListItemButton,
  Typography, Divider, Avatar, Chip,
  Dialog, DialogTitle, DialogContent,
  TextField, Button, Alert, CircularProgress,
} from '@mui/material';
import {
  CreditCard, AdminPanelSettings, Assessment,
  Logout, Lock, People,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { usersApi, authApi } from '../api/client';
import FavoritesDialog from '../components/FavoritesDialog';

interface UserItem {
  user_id: string;
  name: string;
  department: string;
  is_favorite: boolean;
}

const MorePage: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [partnerDialog, setPartnerDialog] = useState(false);

  const [pwDialog, setPwDialog] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (location.state?.openFavorites) {
      setPartnerDialog(true);
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await usersApi.list();
      setAllUsers(res.data.users);
    } catch {
      // ignore
    }
  }, []);

  const handleChangePw = async () => {
    if (!currentPw || !newPw) { setPwError('모든 항목을 입력하세요.'); return; }
    if (newPw.length < 6) { setPwError('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    setPwSaving(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      setPwDialog(false);
      setCurrentPw(''); setNewPw(''); setPwError('');
    } catch (err: any) {
      setPwError(err.response?.data?.detail || '비밀번호 변경에 실패했습니다.');
    } finally {
      setPwSaving(false);
    }
  };

  const favoriteUsers = allUsers.filter((u) => u.is_favorite && u.user_id !== user?.user_id);

  return (
    <Layout title="더보기">
      <Box sx={{ p: 2 }}>
        {/* 프로필 */}
        <Card sx={{ mb: 2, p: 2 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 22 }}>
              {user?.name?.[0]}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>{user?.name}</Typography>
              <Typography variant="body2" color="text.secondary">{user?.user_id}</Typography>
              <Box display="flex" gap={0.5} mt={0.5}>
                {user?.department && <Chip label={user.department} size="small" />}
                {isAdmin && <Chip label="관리자" size="small" color="error" />}
              </Box>
            </Box>
          </Box>
        </Card>

        {/* 메뉴 */}
        <Card sx={{ mb: 2 }}>
          <List disablePadding>
            <ListItemButton onClick={() => navigate('/cards')}>
              <ListItemIcon><CreditCard color="primary" /></ListItemIcon>
              <ListItemText primary="법인카드 현황" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => setPartnerDialog(true)}>
              <ListItemIcon><People color="primary" /></ListItemIcon>
              <ListItemText
                primary="즐겨찾기 동료"
                secondary={favoriteUsers.length > 0
                  ? favoriteUsers.map((u) => u.name).join(', ')
                  : '탭하여 즐겨찾기 설정'
                }
              />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => setPwDialog(true)}>
              <ListItemIcon><Lock color="primary" /></ListItemIcon>
              <ListItemText primary="비밀번호 변경" />
            </ListItemButton>
          </List>
        </Card>

        {isAdmin && (
          <Card sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1.5, display: 'block' }}>
              관리자 메뉴
            </Typography>
            <List disablePadding>
              <ListItemButton onClick={() => navigate('/admin')}>
                <ListItemIcon><Assessment color="error" /></ListItemIcon>
                <ListItemText primary="관리자 대시보드" />
              </ListItemButton>
              <Divider />
              <ListItemButton onClick={() => navigate('/admin/users')}>
                <ListItemIcon><AdminPanelSettings color="error" /></ListItemIcon>
                <ListItemText primary="사용자 관리" />
              </ListItemButton>
            </List>
          </Card>
        )}

        <Card>
          <ListItemButton onClick={() => { logout(); navigate('/login'); }}>
            <ListItemIcon><Logout color="error" /></ListItemIcon>
            <ListItemText primary="로그아웃" primaryTypographyProps={{ color: 'error' }} />
          </ListItemButton>
        </Card>
      </Box>

      {/* 즐겨찾기 동료 관리 다이얼로그 */}
      <FavoritesDialog
        open={partnerDialog}
        onClose={() => setPartnerDialog(false)}
        onChanged={(updated) => setAllUsers(updated)}
      />

      {/* 비밀번호 변경 */}
      <Dialog open={pwDialog} onClose={() => setPwDialog(false)} fullWidth>
        <DialogTitle>비밀번호 변경</DialogTitle>
        <DialogContent>
          {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}
          <TextField
            label="현재 비밀번호"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="새 비밀번호 (6자 이상)"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 2 }}>
          <Button onClick={() => setPwDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleChangePw} disabled={pwSaving}>
            {pwSaving ? <CircularProgress size={20} /> : '변경'}
          </Button>
        </Box>
      </Dialog>
    </Layout>
  );
};

export default MorePage;
