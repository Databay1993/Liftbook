import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Keyboard, PanResponder, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  getAllExercises, createTemplate, updateTemplate, addCustomExercise, Template,
} from '../storage/database';
import Toast from '../components/Toast';

const ITEM_H = 60;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  template?: Template | null;   // set → edit mode, null/undefined → create mode
}

export default function TemplateEditorScreen({ visible, onClose, onSaved, template }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [allExercises, setAllExercises] = useState<{ id: number; name: string; isCustom: boolean }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [newExName, setNewExName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dragIndex, setDragIndex] = useState(-1);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const dragY = useRef(new Animated.Value(0)).current;

  const selectedRef = useRef<string[]>([]);
  const dragIdxRef = useRef(-1);
  const hoverIdxRef = useRef(-1);
  useEffect(() => { selectedRef.current = selectedExercises; }, [selectedExercises]);

  useEffect(() => {
    if (visible) {
      loadExercises();
      setName(template?.name ?? '');
      setSelectedExercises(template?.exercises ?? []);
    }
  }, [visible, template?.id]);

  async function loadExercises() {
    setAllExercises(await getAllExercises());
  }

  // One PanResponder per slot — created once, reads state via refs (never stale)
  const prs = useMemo(
    () =>
      Array.from({ length: 30 }, (_, slot) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,

          onPanResponderGrant: () => {
            dragIdxRef.current = slot;
            hoverIdxRef.current = slot;
            dragY.setValue(0);
            setDragIndex(slot);
            setHoverIndex(slot);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },

          onPanResponderMove: (_, gs) => {
            dragY.setValue(gs.dy);
            const next = clamp(
              Math.round(dragIdxRef.current + gs.dy / ITEM_H),
              0,
              selectedRef.current.length - 1,
            );
            if (next !== hoverIdxRef.current) {
              hoverIdxRef.current = next;
              setHoverIndex(next);
            }
          },

          onPanResponderRelease: () => {
            const from = dragIdxRef.current;
            const to   = hoverIdxRef.current;
            if (from !== to) {
              setSelectedExercises(prev => {
                const arr = [...prev];
                const [item] = arr.splice(from, 1);
                arr.splice(to, 0, item);
                return arr;
              });
            }
            resetDrag();
          },

          onPanResponderTerminate: () => resetDrag(),
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function resetDrag() {
    dragIdxRef.current = -1;
    hoverIdxRef.current = -1;
    setDragIndex(-1);
    setHoverIndex(-1);
    dragY.setValue(0);
  }

  function toggleExercise(ex: string) {
    setSelectedExercises(p => p.includes(ex) ? p.filter(e => e !== ex) : [...p, ex]);
  }

  function moveExercise(from: number, dir: -1 | 1) {
    const to = from + dir;
    setSelectedExercises(prev => {
      if (to < 0 || to >= prev.length) return prev;
      const arr = [...prev];
      [arr[from], arr[to]] = [arr[to], arr[from]];
      return arr;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  async function handleAddNew() {
    const n = newExName.trim();
    if (!n) return;
    try { await addCustomExercise(n); await loadExercises(); } catch { /* already exists */ }
    setSelectedExercises(p => p.includes(n) ? p : [...p, n]);
    setNewExName('');
  }

  function closePicker() { setShowPicker(false); setSearch(''); setNewExName(''); Keyboard.dismiss(); }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg(t('errorNoName'));
      setTimeout(() => setErrorMsg(null), 2500);
      return;
    }
    if (!selectedExercises.length) {
      setErrorMsg(t('errorNoExercises'));
      setTimeout(() => setErrorMsg(null), 2500);
      return;
    }
    try {
      if (template) await updateTemplate(template.id, trimmed, selectedExercises);
      else          await createTemplate(trimmed, selectedExercises);
      onSaved();
      onClose();
    } catch {
      setErrorMsg(t('errorSaveFailed'));
      setTimeout(() => setErrorMsg(null), 3000);
    }
  }

  const filtered = allExercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  const canSave  = !!name.trim() && selectedExercises.length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
            <Text style={styles.cancelBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{template ? t('editTemplate') : t('newTemplate')}</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
            hitSlop={{ top:10,bottom:10,left:10,right:10 }}
            activeOpacity={canSave ? 0.7 : 1}
          >
            <Text style={[styles.saveBtnTxt, !canSave && { color: colors.muted }]}>
              {template ? t('save') : t('createTemplate')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plan name */}
        <View style={styles.nameSection}>
          <TextInput
            style={styles.nameInput}
            placeholder={t('templateName')}
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>

        {/* Exercise list — plain View, no ScrollView → PanResponder works */}
        <View style={styles.listSection}>
          <Text style={styles.listLabel}>{t('templateExercises').toUpperCase()}</Text>

          {selectedExercises.length === 0 ? (
            <Text style={styles.emptyHint}>{t('addExercisesToTemplate')}</Text>
          ) : (
            selectedExercises.map((ex, idx) => {
              const isActive  = dragIndex === idx;
              const showAbove = hoverIndex === idx && dragIndex > idx;
              const showBelow = hoverIndex === idx && dragIndex < idx;

              return (
                <View key={`${ex}-${idx}`} style={[styles.rowWrap, isActive && styles.rowWrapActive]}>
                  {showAbove && <View style={styles.dropLine} />}

                  <Animated.View
                    style={[
                      styles.row,
                      isActive && styles.rowLifted,
                      isActive && { transform: [{ translateY: dragY }] },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => toggleExercise(ex)}
                      hitSlop={{ top:10,bottom:10,left:8,right:8 }}
                    >
                      <Text style={styles.removeTxt}>✕</Text>
                    </TouchableOpacity>

                    <Text style={styles.posNum}>{idx + 1}</Text>

                    <Text style={styles.rowName} numberOfLines={1}>{ex}</Text>

                    <TouchableOpacity
                      style={[styles.moveBtn, idx === 0 && styles.moveBtnOff]}
                      onPress={() => moveExercise(idx, -1)}
                      disabled={idx === 0}
                      hitSlop={{ top:8,bottom:8,left:4,right:4 }}
                    >
                      <Text style={[styles.moveBtnTxt, idx === 0 && styles.moveBtnTxtOff]}>↑</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.moveBtn, idx === selectedExercises.length - 1 && styles.moveBtnOff]}
                      onPress={() => moveExercise(idx, 1)}
                      disabled={idx === selectedExercises.length - 1}
                      hitSlop={{ top:8,bottom:8,left:4,right:4 }}
                    >
                      <Text style={[styles.moveBtnTxt, idx === selectedExercises.length - 1 && styles.moveBtnTxtOff]}>↓</Text>
                    </TouchableOpacity>

                    <View
                      {...prs[idx]?.panHandlers}
                      style={styles.handle}
                      hitSlop={{ top:10,bottom:10,left:4,right:4 }}
                    >
                      <Text style={styles.handleTxt}>☰</Text>
                    </View>
                  </Animated.View>

                  {showBelow && <View style={styles.dropLine} />}
                </View>
              );
            })
          )}

          <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.addBtnTxt}>+ {t('addExercise')}</Text>
          </TouchableOpacity>
        </View>

        {errorMsg && <Toast message={errorMsg} />}
      </KeyboardAvoidingView>

      {/* ── Exercise Picker ── */}
      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePicker}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={closePicker} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={styles.cancelBtn}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('chooseExercise')}</Text>
            <TouchableOpacity onPress={closePicker} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={[styles.saveBtnTxt, { color: colors.accent }]}>OK</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('search')}
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          <View style={styles.newExWrap}>
            <TextInput
              style={styles.newExInput}
              placeholder={t('newExercisePlaceholder')}
              placeholderTextColor={colors.muted}
              value={newExName}
              onChangeText={setNewExName}
              returnKeyType="done"
              onSubmitEditing={handleAddNew}
            />
            <TouchableOpacity
              style={[styles.newExBtn, !newExName.trim() && { opacity: 0.35 }]}
              onPress={handleAddNew}
              disabled={!newExName.trim()}
            >
              <Text style={styles.newExBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={i => i.name}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            renderItem={({ item }: { item: typeof allExercises[0] }) => {
              const sel = selectedExercises.includes(item.name);
              return (
                <TouchableOpacity
                  style={[styles.exRow, sel && styles.exRowSel]}
                  onPress={() => toggleExercise(item.name)}
                >
                  <Text style={[styles.exRowName, sel && { color: colors.accent }]}>{item.name}</Text>
                  {item.isCustom && <Text style={styles.badge}>{t('custom')}</Text>}
                  {sel && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    headerTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, letterSpacing: 2, color: c.text },
    cancelBtn:   { color: c.muted, fontSize: 18, padding: 4 },
    saveBtn:     { backgroundColor: c.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    saveBtnOff:  { backgroundColor: c.surface2 },
    saveBtnTxt:  { color: '#000', fontWeight: '700', fontSize: 13 },

    nameSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    nameInput: {
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 8,
      fontSize: 16,
    },

    listSection: { padding: 16 },
    listLabel: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 14,
      letterSpacing: 2,
      color: c.muted,
      marginBottom: 10,
    },
    emptyHint: { color: c.muted, fontSize: 13, marginBottom: 12 },

    rowWrap:       { zIndex: 1 },
    rowWrapActive: { zIndex: 50 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: ITEM_H,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      marginBottom: 6,
      paddingHorizontal: 10,
      gap: 6,
    },
    rowLifted: {
      borderColor: c.accent,
      backgroundColor: c.surface2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 12,
    },

    removeTxt: { color: c.muted, fontSize: 16 },
    rowName:   { flex: 1, color: c.text, fontSize: 15 },

    posNum: {
      fontFamily: 'BebasNeue_400Regular',
      fontSize: 18,
      color: c.accent,
      minWidth: 18,
      textAlign: 'center',
    },

    moveBtn: {
      width: 30, height: 30,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moveBtnOff:    { opacity: 0.3 },
    moveBtnTxt:    { color: c.accent, fontSize: 15, fontWeight: '700' },
    moveBtnTxtOff: { color: c.muted },

    handle:    { paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
    handleTxt: { color: c.muted, fontSize: 20 },

    dropLine: {
      height: 2,
      backgroundColor: c.accent,
      borderRadius: 2,
      marginHorizontal: 4,
      marginVertical: 2,
    },

    addBtn: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: c.accent,
      borderStyle: 'dashed',
      borderRadius: 8,
      padding: 13,
      alignItems: 'center',
    },
    addBtnTxt: { color: c.accent, fontSize: 14 },

    // Picker
    searchWrap: { padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    searchInput: {
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 8,
      fontSize: 15,
    },
    newExWrap: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface2,
    },
    newExInput: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 8,
      fontSize: 14,
    },
    newExBtn:    { backgroundColor: c.accent, width: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    newExBtnTxt: { color: '#000', fontSize: 24, fontWeight: '700' },

    exRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, gap: 8 },
    exRowSel: { backgroundColor: c.accentBg },
    exRowName:{ flex: 1, fontSize: 15, color: c.text },
    badge:    { fontSize: 10, color: c.muted },
    check:    { color: c.accent, fontSize: 16, fontWeight: '700' },
  });
}
