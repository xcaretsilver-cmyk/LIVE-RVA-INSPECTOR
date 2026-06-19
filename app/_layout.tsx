// Powered by OnSpace.AI
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { InspectorProvider } from '@/contexts/InspectorContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <InspectorProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
          </Stack>
        </InspectorProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
