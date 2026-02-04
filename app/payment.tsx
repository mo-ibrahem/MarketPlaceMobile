import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview'; // --- THIS IS THE CORRECTED LINE ---

export default function PaymentScreen() {
    const { paymentToken } = useLocalSearchParams<{ paymentToken: string }>();
    const router = useRouter();

    const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/957263?payment_token=${paymentToken}`;

    const handleNavigationStateChange = (navState: any) => {
        if (navState.url.includes('success=true')) {
            console.log("Payment Successful!");
            Alert.alert("Payment Successful!", "Your order has been confirmed.");
            router.replace('/(tabs)');
        } else if (navState.url.includes('success=false')) {
            console.log("Payment Failed!");
            Alert.alert("Payment Failed", "There was an issue with your payment. Please try again.");
            router.back();
        }
    };

    if (!paymentToken) {
        return (
            <View style={styles.center}>
                <Text>Invalid payment session.</Text>
            </View>
        );
    }

    return (
        <WebView
            source={{ uri: paymentUrl }}
            onNavigationStateChange={handleNavigationStateChange}
            startInLoadingState={true}
            renderLoading={() => <ActivityIndicator size="large" style={StyleSheet.absoluteFill} />}
        />
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});