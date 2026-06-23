import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = ({ navigation }: any) => {
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [smsUpdates, setSmsUpdates] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const settingsSections = [
    {
      title: 'Notifications',
      items: [
        {
          title: 'Push Notifications',
          subtitle: 'Receive notifications about appointments and messages',
          type: 'switch',
          value: notifications,
          onValueChange: setNotifications,
        },
        {
          title: 'Email Updates',
          subtitle: 'Get updates via email',
          type: 'switch',
          value: emailUpdates,
          onValueChange: setEmailUpdates,
        },
        {
          title: 'SMS Updates',
          subtitle: 'Get updates via SMS',
          type: 'switch',
          value: smsUpdates,
          onValueChange: setSmsUpdates,
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          title: 'Dark Mode',
          subtitle: 'Use dark theme',
          type: 'switch',
          value: darkMode,
          onValueChange: setDarkMode,
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        {
          title: 'Privacy Policy',
          subtitle: 'View our privacy policy',
          type: 'navigation',
          onPress: () => Alert.alert('Privacy Policy', 'Privacy policy content would be displayed here'),
        },
        {
          title: 'Terms of Service',
          subtitle: 'View terms of service',
          type: 'navigation',
          onPress: () => Alert.alert('Terms of Service', 'Terms of service content would be displayed here'),
        },
        {
          title: 'Data Export',
          subtitle: 'Export your health data',
          type: 'navigation',
          onPress: () => Alert.alert('Data Export', 'Your health data export will be sent to your email'),
        },
        {
          title: 'Delete Account',
          subtitle: 'Permanently delete your account',
          type: 'navigation',
          onPress: () => {
            Alert.alert(
              'Delete Account',
              'Are you sure you want to delete your account? This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive' },
              ]
            );
          },
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          title: 'Help Center',
          subtitle: 'Get help and support',
          type: 'navigation',
          onPress: () => Alert.alert('Help Center', 'Help center content would be displayed here'),
        },
        {
          title: 'Contact Support',
          subtitle: 'Get in touch with our support team',
          type: 'navigation',
          onPress: () => Alert.alert('Contact Support', 'support@careconnect.com'),
        },
        {
          title: 'Report a Bug',
          subtitle: 'Report issues with the app',
          type: 'navigation',
          onPress: () => Alert.alert('Report Bug', 'Bug report form would be displayed here'),
        },
      ],
    },
  ];

  const renderSettingItem = (item: any) => (
    <TouchableOpacity
      key={item.title}
      style={styles.settingItem}
      onPress={item.onPress}
      disabled={item.type === 'switch'}
    >
      <View style={styles.settingItemLeft}>
        <Text style={styles.settingItemTitle}>{item.title}</Text>
        <Text style={styles.settingItemSubtitle}>{item.subtitle}</Text>
      </View>
      <View style={styles.settingItemRight}>
        {item.type === 'switch' ? (
          <Switch
            value={item.value}
            onValueChange={item.onValueChange}
            trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
            thumbColor={item.value ? 'white' : '#BDBDBD'}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#666" />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section: any) => (
    <View key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionContent}>
        {section.items.map(renderSettingItem)}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {settingsSections.map(renderSection)}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sectionContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingItemLeft: {
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  settingItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  settingItemRight: {
    marginLeft: 15,
  },
});

export default SettingsScreen;


