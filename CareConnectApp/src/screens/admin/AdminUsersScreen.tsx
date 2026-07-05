import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { CompositeScreenProps } from '@react-navigation/native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { StackScreenProps } from '@react-navigation/stack';
import { User } from '../../types';
import {
  fetchUsersPage,
  setUserVerified,
  deleteUserAccount,
  approveDoctorRequest,
  ServiceError,
} from '../../services';
import { AdminDrawerParamList, RootStackParamList } from '../../navigation/types';
import { Card, ErrorBanner, EmptyState, LoadingIndicator } from '../../components';

const PAGE_SIZE = 20;

type Props = CompositeScreenProps<
  DrawerScreenProps<AdminDrawerParamList, 'Users'>,
  StackScreenProps<RootStackParamList>
>;

/**
 * Maps the UI's filter-tab selection to the server-side query constraints
 * `userService.fetchUsersPage` understands. 'All' and 'Patients'/'Doctors'/
 * 'Admins'/'Pending' are mutually exclusive in this UI, so at most one of
 * `roleFilter`/`verifiedFilter` is ever set at a time.
 */
function filterTabToQueryParams(filter: string): { roleFilter?: User['role']; verifiedFilter?: boolean } {
  switch (filter) {
    case 'Patients':
      return { roleFilter: 'patient' };
    case 'Doctors':
      return { roleFilter: 'doctor' };
    case 'Admins':
      return { roleFilter: 'admin' };
    case 'Pending':
      return { verifiedFilter: false };
    default:
      return {};
  }
}

const SEARCH_DEBOUNCE_MS = 400;

const AdminUsersScreen = ({ navigation }: Props) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced separately from `searchQuery` so the search-input state
  // updates immediately (no typing lag) while the actual Firestore query —
  // which now runs server-side per keystroke's settled value, not against
  // an already-fetched in-memory page — only fires after the user pauses.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filters = ['All', 'Patients', 'Doctors', 'Admins', 'Pending'];

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Fetches the first page for the currently selected filter/search. This
   * is now a real server-side query (see userService.fetchUsersPage) —
   * previously, `selectedFilter`/`searchQuery` only filtered whatever page
   * was already in memory, so an admin searching for a user who existed on
   * a later, unfetched page would silently see no results (the bug named
   * explicitly in the code review's "Fastest Path to 90%").
   */
  const fetchUsers = useCallback(async () => {
    setErrorMessage(null);
    setRefetching(true);
    try {
      const { roleFilter, verifiedFilter } = filterTabToQueryParams(selectedFilter);
      const page = await fetchUsersPage({
        pageSize: PAGE_SIZE,
        roleFilter,
        verifiedFilter,
        searchPrefix: debouncedSearch || undefined,
      });
      setUsers(page.users);
      setCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));
    } catch (error) {
      setErrorMessage(error instanceof ServiceError ? error.message : 'Failed to load users.');
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, [selectedFilter, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchMoreUsers = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { roleFilter, verifiedFilter } = filterTabToQueryParams(selectedFilter);
      const page = await fetchUsersPage({
        pageSize: PAGE_SIZE,
        after: cursor,
        roleFilter,
        verifiedFilter,
        searchPrefix: debouncedSearch || undefined,
      });
      setUsers((prev) => [...prev, ...page.users]);
      setCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));
    } catch (error) {
      setErrorMessage(error instanceof ServiceError ? error.message : 'Failed to load more users.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleUserAction = async (user: User, action: 'approve' | 'suspend' | 'delete') => {
    if (action === 'approve') {
      try {
        // Doctors go through the server-side admin-approval Cloud Function,
        // which is the actual enforcement point for "doctors require admin
        // approval before activation" (previously isApproved was written
        // at signup and never checked by any authority). Patients only
        // need the isVerified flag flipped, so they use the simpler path.
        if (user.role === 'doctor') {
          await approveDoctorRequest(user.id);
        } else {
          await setUserVerified(user.id, true);
        }
        Alert.alert('Success', 'User approved successfully');
        fetchUsers();
      } catch (error) {
        const message = error instanceof ServiceError ? error.message : 'Failed to approve user';
        Alert.alert('Error', message);
      }
      return;
    }

    if (action === 'suspend') {
      try {
        await setUserVerified(user.id, false);
        Alert.alert('Success', 'User suspended successfully');
        fetchUsers();
      } catch (error) {
        const message = error instanceof ServiceError ? error.message : 'Failed to suspend user';
        Alert.alert('Error', message);
      }
      return;
    }

    // action === 'delete'
    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserAccount(user.id);
              Alert.alert('Success', 'User deleted successfully');
              fetchUsers();
            } catch (error) {
              const message = error instanceof ServiceError ? error.message : 'Failed to delete user';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: User }) => (
    <Card style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={24} color="#666" />
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userRole}>
            {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
          </Text>
          <View style={styles.userStatus}>
            <Ionicons
              name={item.isVerified ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={item.isVerified ? '#4CAF50' : '#FF9800'}
            />
            <Text style={styles.userStatusText}>
              {item.isVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.userActions}>
        {!item.isVerified && (
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => handleUserAction(item, 'approve')}
            accessibilityRole="button"
            accessibilityLabel={`Approve ${item.name}`}
          >
            <Ionicons name="checkmark" size={16} color="white" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.suspendButton}
          onPress={() => handleUserAction(item, 'suspend')}
          accessibilityRole="button"
          accessibilityLabel={`Suspend ${item.name}`}
        >
          <Ionicons name="pause" size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleUserAction(item, 'delete')}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.name}`}
        >
          <Ionicons name="trash" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderFilter = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === item && styles.filterButtonActive,
      ]}
      onPress={() => setSelectedFilter(item)}
    >
      <Text
        style={[
          styles.filterButtonText,
          selectedFilter === item && styles.filterButtonTextActive,
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingIndicator message="Loading users..." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Management</Text>
        <TouchableOpacity
          style={styles.exportButton}
          accessibilityRole="button"
          accessibilityLabel="Export users"
        >
          <Ionicons name="download" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {errorMessage && <ErrorBanner message={errorMessage} />}

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            accessibilityLabel="Search users by name"
          />
          {refetching && !loading && <ActivityIndicator size="small" color="#2196F3" />}
        </View>
      </View>

      <FlatList
        data={filters}
        renderItem={renderFilter}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersList}
        contentContainerStyle={styles.filtersContainer}
      />

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        style={styles.usersList}
        contentContainerStyle={styles.usersContainer}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={hasMore ? fetchMoreUsers : undefined}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : null}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No users found"
            message={
              searchQuery.trim()
                ? `No users found whose name starts with "${searchQuery.trim()}". Search matches the start of a name, not the middle.`
                : 'Try adjusting your search criteria'
            }
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  footerLoader: {
    marginVertical: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  exportButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filtersList: {
    backgroundColor: 'white',
    paddingVertical: 15,
  },
  filtersContainer: {
    paddingHorizontal: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  usersList: {
    flex: 1,
  },
  usersContainer: {
    padding: 20,
  },
  // Base card visuals (background, radius, shadow) now come from the
  // shared <Card> component; this only adds the list-spacing this screen
  // needs.
  userCard: {
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
    marginBottom: 5,
  },
  userStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userStatusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  userActions: {
    flexDirection: 'row',
    gap: 10,
  },
  approveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suspendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AdminUsersScreen;


