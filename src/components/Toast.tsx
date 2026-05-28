import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface Props {
  message: string;
}

export default function Toast({ message }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [message]);

  return (
    <Animated.View style={[styles.toast, { bottom: insets.bottom + 90, opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    toast: {
      position: 'absolute',
      alignSelf: 'center',
      backgroundColor: c.accent,
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: 30,
      zIndex: 999,
    },
    text: {
      color: '#000',
      fontWeight: '600',
      fontSize: 14,
    },
  });
}
