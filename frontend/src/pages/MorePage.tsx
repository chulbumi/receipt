import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, List, ListItem, ListItemIcon, ListItemText,
  ListItemButton, ListItemAvatar, ListItemSecondaryAction,
  Typography, Divider, Avatar, Chip,
  Dialog, DialogTitle, DialogContent,
  TextField, Button, Alert, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import {
  CreditCard, AdminPanelSettings, Assessment,
  Logout, Lock, People, Star, StarBorder,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { usersApi, authApi } from '../api/client';

interface UserItem {
  user_id: string;
  name: string;
  department: string;
  is_favorite: boolean;
}

const MorePage: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [partnerDialog, setPartnerDialog] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);

  const [pwDialog, setPwDialog] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await usersApi.list();
      setAllUsers(res.data.users);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const openPartnerDialog = () => {
    setSearchText('');
    loadUsers();
    setPartnerDialog(true);
  };

  const toggleFavorite = async (uid: string) => {
    if (favoriteLoading) return;
    setFavoriteLoading(uid);
    try {
      const res = await usersApi.toggleFavorite(uid);
      const { is_favorite } = res.data;
      setAllUsers((prev) =>
        prev
          .map((u) => (u.user_id === uid ? { ...u, is_favorite } : u))
          .sort((a, b) => {
            if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
            return a.name.localeCompare(b.name, 'ko');
          })
      );
    } finally {
      setFavoriteLoading(null);
    }
  };

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
  const filteredUsers = allUsers.filter(
    (u) => u.user_id !== user?.user_id &&
      (searchText === '' || u.name.includes(searchText) || u.department.includes(searchText))
  );

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
            <ListItemButton onClick={openPartnerDialog}>
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

      {/* 즐겨찾기 동료 별표 UI */}
      <Dialog open={partnerDialog} onClose={() => setPartnerDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          즐겨찾기 동료 관리
          <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
            ⭐ 별표를 탭하여 즐겨찾기를 토글하세요
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
            <TextField
              placeholder="이름·부서 검색"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              fullWidth
              size="small"
              autoFocus
            />
          </Box>

          {usersLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <List dense sx={{ maxHeight: '55vh', overflow: 'auto' }}>
              {filteredUsers.map((u) => (
                <ListItem key={u.user_id} disablePadding>
                  <ListItemAvatar sx={{ pl: 1, minWidth: 48 }}>
                    <Avatar sx={{
                      width: 32, height: 32, fontSize: 14,
                      bgcolor: u.is_favorite ? 'warning.light' : 'grey.300',
                    }}>
                      {u.name[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={u.name}
                    secondary={u.department}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: u.is_favorite ? 600 : 400 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title={u.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleFavorite(u.user_id)}
                        disabled={favoriteLoading === u.user_id}
                      >
                        {favoriteLoading === u.user_id
                          ? <CircularProgress size={18} />
                          : u.is_favorite
                            ? <Star sx={{ color: 'warning.main', fontSize: 22 }} />
                            : <StarBorder sx={{ fontSize: 22, color: 'text.disabled' }} />
                        }
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {filteredUsers.length === 0 && (
                <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">검색 결과가 없습니다.</Typography>
                </Box>
              )}
            </List>
          )}
        </DialogContent>
      </Dialog>

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
