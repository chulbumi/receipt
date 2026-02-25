import React from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip,
  List, ListItem, ListItemAvatar, ListItemText, Checkbox,
  Button,
} from '@mui/material';
import { PeopleAlt } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface UserItem {
  user_id: string;
  name: string;
  department: string;
  is_favorite: boolean;
}

interface ParticipantSelectorProps {
  allUsers: UserItem[];
  selectedParticipants: string[];
  onToggle: (uid: string) => void;
}

const ParticipantSelector: React.FC<ParticipantSelectorProps> = ({
  allUsers,
  selectedParticipants,
  onToggle,
}) => {
  const { user: me } = useAuth();
  const navigate = useNavigate();

  const favoriteUsers = allUsers.filter(
    (u) => u.is_favorite && u.user_id !== me?.user_id
  );

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>
            👥 함께한 사람
          </Typography>
          <Button
            size="small"
            startIcon={<PeopleAlt fontSize="small" />}
            onClick={() => navigate('/more', { state: { openFavorites: true } })}
            sx={{ fontSize: '0.75rem' }}
          >
            즐겨찾기 관리
          </Button>
        </Box>

        {/* 나 자신 (항상 포함) */}
        {me && (
          <Box
            sx={{
              display: 'flex', alignItems: 'center',
              py: 0.5, px: 0.5,
              bgcolor: 'action.hover', borderRadius: 1, mb: 1,
            }}
          >
            <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'primary.main', mr: 1.5 }}>
              {me.name?.[0]}
            </Avatar>
            <Typography variant="body2" flex={1} fontWeight={600}>
              {me.name} (나)
            </Typography>
            <Checkbox checked size="small" disabled />
          </Box>
        )}

        {favoriteUsers.length > 0 ? (
          <List dense disablePadding>
            {favoriteUsers.map((u) => (
              <ListItem
                key={u.user_id}
                disablePadding
                sx={{ py: 0.2, cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => onToggle(u.user_id)}
              >
                <Checkbox
                  checked={selectedParticipants.includes(u.user_id)}
                  size="small"
                  sx={{ p: 0.5 }}
                />
                <ListItemAvatar sx={{ minWidth: 36 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'warning.light' }}>
                    {u.name[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={u.name}
                  secondary={u.department}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Box
            sx={{
              py: 2.5, textAlign: 'center',
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              mt: 0.5,
            }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom>
              즐겨찾기 동료가 없습니다.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PeopleAlt fontSize="small" />}
              onClick={() => navigate('/more', { state: { openFavorites: true } })}
            >
              즐겨찾기 추가하러 가기
            </Button>
          </Box>
        )}

        {/* 선택된 참여자 칩 */}
        {selectedParticipants.length > 1 && (
          <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selectedParticipants.map((uid) => {
              const u = allUsers.find((u) => u.user_id === uid);
              const isMe = uid === me?.user_id;
              return (
                <Chip
                  key={uid}
                  label={u?.name || (isMe ? me?.name : uid)}
                  size="small"
                  color="primary"
                  variant="filled"
                  onDelete={isMe ? undefined : () => onToggle(uid)}
                />
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ParticipantSelector;
