import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface Props {
  seconds: number;
  maxSeconds: number;
  onCancel: () => void;
}

export default function TimerBubble({ seconds, maxSeconds, onCancel }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const r = 33;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - seconds / maxSeconds);
  const urgent = seconds <= 10;

  return (
    <TouchableOpacity style={styles.bubble} onPress={onCancel} activeOpacity={0.8}>
      <Svg width={72} height={72} style={StyleSheet.absoluteFill}>
        <Circle cx={36} cy={36} r={r} stroke={colors.border} strokeWidth={3} fill="none" />
        <Circle
          cx={36} cy={36} r={r}
          stroke={urgent ? colors.danger : colors.accent}
          strokeWidth={3}
          fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          originX={36}
          originY={36}
        />
      </Svg>
      <Text style={[styles.num, urgent && { color: colors.danger }]}>{seconds}</Text>
      <Text style={styles.label}>tap ✕</Text>
    </TouchableOpacity>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    bubble: {
      position: 'absolute',
      bottom: 84,
      right: 16,
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 8,
    },
    num: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 22,
      color: c.text,
      lineHeight: 24,
    },
    label: {
      fontSize: 8,
      color: c.muted,
    },
  });
}
