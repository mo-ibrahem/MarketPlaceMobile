import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/services/lib/supabase';

export default function AccountDeletionScreen() {
 const { receipt } = useLocalSearchParams<{ receipt?: string }>();
 const router = useRouter();
 const [status, setStatus] = useState('pending');
 useEffect(() => {
   let mounted = true;
   const timer = setInterval(() => { void refresh(); }, 10000);
   async function refresh() {
     if (!receipt || !/^[0-9a-f-]{36}$/i.test(receipt)) { if(mounted) setStatus('unavailable'); return; }
     const { data, error } = await (supabase.rpc as any)('account_deletion_status', { p_receipt: receipt });
     if (mounted) {
       const next = error || !data?.[0] ? 'unavailable' : data[0].status;
       setStatus(next);
       if (next === 'complete') clearInterval(timer);
     }
   }
   void refresh();
   return () => { mounted = false; clearInterval(timer); };
 }, [receipt]);
 return <SafeAreaView style={styles.page}><View style={styles.card}>
   <Text style={styles.title}>{status === 'complete' ? 'Account deleted • تم حذف الحساب' : 'Account deletion • حذف الحساب'}</Text>
   <Text style={styles.text}>{status === 'unavailable'
    ? 'We could not verify this deletion request. Please try again later or contact info@egbay.shop.\nتعذر التحقق من طلب الحذف. حاول لاحقاً أو تواصل معنا.'
    : status === 'complete'
    ? 'Your account and uploaded content have been removed.\nتم حذف حسابك والمحتوى الذي رفعته.'
    : 'Your account is disabled. Cleanup is retried automatically each minute. This screen checks progress automatically. If it remains pending, contact info@egbay.shop.\nتم إيقاف الوصول للحساب. تُعاد محاولة الحذف تلقائياً كل دقيقة. تواصل معنا إذا استمر الانتظار.'}</Text>
   <Text selectable style={styles.receipt}>Support reference: {receipt}</Text>
   <Pressable style={styles.button} onPress={() => router.replace('/login')}><Text style={styles.label}>Return to sign in</Text></Pressable>
 </View></SafeAreaView>;
}
const styles = StyleSheet.create({
 page:{flex:1,backgroundColor:'#F7F8FA',justifyContent:'center',padding:24},
 card:{padding:24,borderRadius:20,backgroundColor:'white',gap:20},
 title:{fontSize:23,fontWeight:'700',color:'#172033'},text:{fontSize:16,lineHeight:25,color:'#384456'},
 receipt:{fontSize:12,color:'#697586'},button:{padding:16,borderRadius:12,backgroundColor:'#3665F3'},
 label:{textAlign:'center',color:'white',fontWeight:'700'},
});
