import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, List, ListItem, ListItemAvatar, ListItemText,
  ListItemSecondaryAction, Avatar, Typography,
  Dialog, DialogTitle, DialogContent,
  TextField, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';
import { usersApi } from '../api/client';

interface UserItem {
  user_id: string;
  name: string;
  department: string;
  is_favorite: boolean;
}

interface FavoritesDialogProps {
  open: boolean;
  onClose: () => void;
  /** 즐겨찾기 변경 후 콜백 (목록 새로고침 등) */
  onChanged?: (users: UserItem[]) => void;
}

const FavoritesDialog: React.FC<FavoritesDialogProps> = ({ open, onClose, onChanged }) => {
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list();
      setAllUsers(res.data.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSearchText('');
      loadUsers();
    }
  }, [open, loadUsers]);

  const toggleFavorite = async (uid: string) => {
    if (favoriteLoading) return;
    setFavoriteLoading(uid);
    try {
      const res = await usersApi.toggleFavorite(uid);
      const { is_favorite } = res.data;
      setAllUsers((prev) => {
        const updated = prev
          .map((u) => (u.user_id === uid ? { ...u, is_favorite } : u))
          .sort((a, b) => {
            if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
            return a.name.localeCompare(b.name, 'ko');
          });
        onChanged?.(updated);
        return updated;
      });
    } finally {
      setFavoriteLoading(null);
    }
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      searchText === '' ||
      u.name.includes(searchText) ||
      u.department.includes(searchText)
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
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

        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <List dense sx={{ maxHeight: '55vh', overflow: 'auto' }}>
            {filteredUsers.map((u) => (
              <ListItem key={u.user_id} disablePadding>
                <ListItemAvatar sx={{ pl: 1, minWidth: 48 }}>
                  <Avatar
                    sx={{
                      width: 32, height: 32, fontSize: 14,
                      bgcolor: u.is_favorite ? 'warning.light' : 'grey.300',
                    }}
                  >
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
                      {favoriteLoading === u.user_id ? (
                        <CircularProgress size={18} />
                      ) : u.is_favorite ? (
                        <Star sx={{ color: 'warning.main', fontSize: 22 }} />
                      ) : (
                        <StarBorder sx={{ fontSize: 22, color: 'text.disabled' }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {filteredUsers.length === 0 && !loading && (
              <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">검색 결과가 없습니다.</Typography>
              </Box>
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FavoritesDialog;
