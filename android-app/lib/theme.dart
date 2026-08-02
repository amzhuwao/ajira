import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AjiraColors {
  static const forest = Color(0xFF1A5C45);
  static const forestDeep = Color(0xFF124434);
  static const forestGlow = Color(0xFF2A7A5C);
  static const cream = Color(0xFFF7F3EC);
  static const sand = Color(0xFFEDE6DA);
  static const ink = Color(0xFF0C1222);
  static const inkSoft = Color(0xFF5C6578);
  static const panel = Color(0xFFFFFCF7);
  static const line = Color(0xFFD9D1C3);
  static const danger = Color(0xFFB42318);
}

ThemeData buildAjiraTheme() {
  final base = ColorScheme.fromSeed(
    seedColor: AjiraColors.forest,
    primary: AjiraColors.forest,
    surface: AjiraColors.cream,
    brightness: Brightness.light,
  );

  final textTheme = GoogleFonts.sourceSans3TextTheme().copyWith(
    displayLarge: GoogleFonts.fraunces(
      fontWeight: FontWeight.w600,
      color: AjiraColors.ink,
    ),
    displayMedium: GoogleFonts.fraunces(
      fontWeight: FontWeight.w600,
      color: AjiraColors.ink,
    ),
    headlineMedium: GoogleFonts.fraunces(
      fontWeight: FontWeight.w600,
      color: AjiraColors.ink,
      fontSize: 28,
    ),
    headlineSmall: GoogleFonts.fraunces(
      fontWeight: FontWeight.w600,
      color: AjiraColors.ink,
      fontSize: 22,
    ),
    titleLarge: GoogleFonts.fraunces(
      fontWeight: FontWeight.w600,
      color: AjiraColors.ink,
    ),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: AjiraColors.cream,
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: AjiraColors.forest,
      foregroundColor: AjiraColors.cream,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.fraunces(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        color: AjiraColors.cream,
      ),
    ),
    cardTheme: CardThemeData(
      color: AjiraColors.panel,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AjiraColors.line),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AjiraColors.panel,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AjiraColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AjiraColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AjiraColors.forest, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AjiraColors.forest,
        foregroundColor: AjiraColors.cream,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AjiraColors.forest,
        minimumSize: const Size.fromHeight(48),
        side: const BorderSide(color: AjiraColors.forest),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AjiraColors.panel,
      indicatorColor: AjiraColors.sand,
      labelTextStyle: WidgetStatePropertyAll(
        GoogleFonts.sourceSans3(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    ),
  );
}
