import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { PositionPoint, positionCounts } from '../lib/analytics';

interface Props {
  points: PositionPoint[];
}

const CHART_H = 96;
const PAD_L   = 26;
const PAD_R   = 10;
const PAD_TOP = 10;
const PAD_BOT = 20;

/**
 * Where the exercise sat in each workout, over time.
 *
 * Position one at the top, so a line drifting downwards means the exercise
 * kept moving later in the session — which is what the comparison groups are
 * built on, and worth being able to see rather than infer.
 */
export default function PositionTimeline({ points }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (points.length === 0) return null;

  const screenW = Dimensions.get('window').width;
  const chartW  = screenW - 64;
  const innerW  = chartW - PAD_L - PAD_R;
  const innerH  = CHART_H - PAD_TOP - PAD_BOT;

  const maxPosition = Math.max(...points.map(p => Math.max(p.position, p.total)), 2);
  const counts = positionCounts(points);
  const usual = counts[0];

  const toX = (i: number) => PAD_L + (i / Math.max(points.length - 1, 1)) * innerW;
  // Position 1 belongs at the top: the exercise came first
  const toY = (position: number) =>
    PAD_TOP + ((position - 1) / Math.max(maxPosition - 1, 1)) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.position).toFixed(1)}`)
    .join(' ');

  // A gridline per position, but never so many that they blur together
  const step = maxPosition > 8 ? 2 : 1;
  const rows = Array.from({ length: maxPosition }, (_, i) => i + 1).filter(p => p % step === 1 || step === 1);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('positionTitle')}</Text>

      <Svg width={chartW} height={CHART_H}>
        {rows.map(p => (
          <React.Fragment key={p}>
            <Line
              x1={PAD_L} y1={toY(p)} x2={PAD_L + innerW} y2={toY(p)}
              stroke={colors.border} strokeWidth={1} strokeDasharray="3,4"
            />
            <SvgText
              x={PAD_L - 6} y={toY(p) + 3.5}
              fontSize={9} fill={colors.muted} textAnchor="end"
            >
              {p}.
            </SvgText>
          </React.Fragment>
        ))}

        {points.length > 1 && (
          <Path d={path} stroke={colors.accent} strokeWidth={2} fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map((p, i) => (
          <Circle key={p.workoutId} cx={toX(i)} cy={toY(p.position)} r={4} fill={colors.accent} />
        ))}

        {[0, points.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(i => (
            <SvgText
              key={`x${i}`}
              x={toX(i)} y={CHART_H - 5}
              fontSize={9} fill={colors.muted}
              textAnchor={i === 0 ? 'start' : 'end'}
            >
              {formatDate(points[i].date)}
            </SvgText>
          ))}
      </Svg>

      <Text style={styles.summary}>
        {t('positionUsual', { position: usual.position, count: usual.count, total: points.length })}
      </Text>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: c.surface2,
      borderWidth: 1, borderColor: c.border,
      borderRadius: 8,
      padding: 10,
      gap: 4,
    },
    title: {
      fontSize: 10, color: c.muted,
      textTransform: 'uppercase', letterSpacing: 1,
    },
    summary: { fontSize: 11, color: c.text },
  });
}
