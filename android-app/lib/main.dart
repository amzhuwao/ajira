import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

const String kAppUrl = 'https://ajira.online';
const Color kForest = Color(0xFF1A5C45);
const Color kCream = Color(0xFFF7F3EC);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: kForest,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: kCream,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const AjiraApp());
}

class AjiraApp extends StatelessWidget {
  const AjiraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ajira',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: kForest,
          primary: kForest,
          surface: kCream,
        ),
        scaffoldBackgroundColor: kCream,
        useMaterial3: true,
      ),
      home: const AjiraHomePage(),
    );
  }
}

class AjiraHomePage extends StatefulWidget {
  const AjiraHomePage({super.key});

  @override
  State<AjiraHomePage> createState() => _AjiraHomePageState();
}

class _AjiraHomePageState extends State<AjiraHomePage> {
  late final WebViewController _controller;
  var _loading = true;
  var _progress = 0;
  String? _error;

  static final Uri _homeUri = Uri.parse(kAppUrl);

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(kCream)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (!mounted) return;
            setState(() => _progress = progress);
          },
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() {
              _loading = true;
              _error = null;
            });
          },
          onPageFinished: (_) {
            if (!mounted) return;
            setState(() {
              _loading = false;
              _progress = 100;
            });
          },
          onWebResourceError: (error) {
            if (!mounted) return;
            // Ignore subframe / cancelled errors; surface main-frame failures.
            if (error.isForMainFrame ?? true) {
              setState(() {
                _loading = false;
                _error = error.description;
              });
            }
          },
          onNavigationRequest: (request) async {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;
            if (_shouldOpenExternally(uri)) {
              await _launchExternal(uri);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      );

    _configureAndroid();
    _controller.loadRequest(_homeUri);
  }

  Future<void> _configureAndroid() async {
    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      await platform.setMediaPlaybackRequiresUserGesture(true);
      // Cookies + DOM storage for Auth.js sessions and Paynow return flows.
      await platform.setOnShowFileSelector((params) async {
        // File uploads (dispute evidence, message attachments) — defer to
        // system picker when the platform plugin supports it in future.
        return <String>[];
      });
    }
  }

  bool _shouldOpenExternally(Uri uri) {
    final scheme = uri.scheme.toLowerCase();
    if (scheme == 'mailto' || scheme == 'tel' || scheme == 'sms') {
      return true;
    }
    if (scheme != 'http' && scheme != 'https') {
      return true;
    }
    final host = uri.host.toLowerCase();
    // Keep Ajira and Paynow checkout in-app; open other hosts externally.
    if (host == 'ajira.online' || host == 'www.ajira.online') {
      return false;
    }
    if (host.endsWith('paynow.co.zw') || host.contains('paynow')) {
      return false;
    }
    return true;
  }

  Future<void> _launchExternal(Uri uri) async {
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open ${uri.scheme} link')),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open link')),
      );
    }
  }

  Future<bool> _handleBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return false;
    }
    return true;
  }

  Future<void> _reload() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    await _controller.loadRequest(_homeUri);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldLeave = await _handleBack();
        if (shouldLeave && context.mounted) {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              if (_error == null)
                WebViewWidget(controller: _controller)
              else
                _ErrorPane(message: _error!, onRetry: _reload),
              if (_loading && _error == null)
                const ColoredBox(
                  color: kCream,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Ajira',
                          style: TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w600,
                            color: kForest,
                            letterSpacing: -0.5,
                          ),
                        ),
                        SizedBox(height: 24),
                        SizedBox(
                          width: 28,
                          height: 28,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: kForest,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_loading && _progress > 0 && _progress < 100 && _error == null)
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  child: LinearProgressIndicator(
                    value: _progress / 100,
                    minHeight: 2,
                    backgroundColor: Colors.transparent,
                    color: kForest,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorPane extends StatelessWidget {
  const _ErrorPane({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: kCream,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Ajira',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w600,
                  color: kForest,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Could not load Ajira.\n$message',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF5C574F)),
              ),
              const SizedBox(height: 24),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: kForest),
                onPressed: onRetry,
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
