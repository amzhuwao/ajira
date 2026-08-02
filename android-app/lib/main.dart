import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';
import 'state/auth_controller.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: AjiraColors.forest,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AjiraColors.cream,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const ProviderScope(child: AjiraApp()));
}

class AjiraApp extends ConsumerWidget {
  const AjiraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final router = ref.watch(routerProvider);

    if (auth.booting) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildAjiraTheme(),
        home: const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return MaterialApp.router(
      title: 'Ajira',
      debugShowCheckedModeBanner: false,
      theme: buildAjiraTheme(),
      routerConfig: router,
    );
  }
}
