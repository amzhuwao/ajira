import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/auth_controller.dart';
import '../../theme.dart';

class MainShell extends ConsumerWidget {
  const MainShell({super.key, required this.child});

  final Widget child;

  List<_TabSpec> _tabsFor(String role) {
    switch (role) {
      case 'SELLER':
        return const [
          _TabSpec('/home', 'Home', Icons.home_outlined, Icons.home),
          _TabSpec('/browse', 'Browse', Icons.search, Icons.search),
          _TabSpec('/messages', 'Chats', Icons.chat_bubble_outline, Icons.chat_bubble),
          _TabSpec('/wallet', 'Wallet', Icons.account_balance_wallet_outlined, Icons.account_balance_wallet),
          _TabSpec('/more', 'More', Icons.menu, Icons.menu),
        ];
      case 'ADMIN':
        return const [
          _TabSpec('/admin', 'Home', Icons.dashboard_outlined, Icons.dashboard),
          _TabSpec('/projects', 'Projects', Icons.folder_outlined, Icons.folder),
          _TabSpec('/messages', 'Chats', Icons.chat_bubble_outline, Icons.chat_bubble),
          _TabSpec('/more', 'More', Icons.menu, Icons.menu),
        ];
      default:
        return const [
          _TabSpec('/home', 'Home', Icons.home_outlined, Icons.home),
          _TabSpec('/projects', 'Projects', Icons.folder_outlined, Icons.folder),
          _TabSpec('/messages', 'Chats', Icons.chat_bubble_outline, Icons.chat_bubble),
          _TabSpec('/browse', 'Hire', Icons.people_outline, Icons.people),
          _TabSpec('/more', 'More', Icons.menu, Icons.menu),
        ];
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final tabs = _tabsFor(user.role);
    final location = GoRouterState.of(context).uri.path;
    var selected = 0;
    for (var i = 0; i < tabs.length; i++) {
      if (location == tabs[i].path || location.startsWith('${tabs[i].path}/')) {
        selected = i;
        break;
      }
    }

    final hideNav = location.startsWith('/escrow/') ||
        (location.startsWith('/projects/') && location != '/projects') ||
        RegExp(r'^/messages/[^/]+').hasMatch(location) ||
        RegExp(r'^/disputes/[^/]+').hasMatch(location) ||
        RegExp(r'^/talent/[^/]+').hasMatch(location) ||
        location.startsWith('/admin/');

    return Scaffold(
      body: child,
      bottomNavigationBar: hideNav
          ? null
          : NavigationBar(
              selectedIndex: selected.clamp(0, tabs.length - 1),
              onDestinationSelected: (i) => context.go(tabs[i].path),
              destinations: [
                for (final t in tabs)
                  NavigationDestination(
                    icon: Icon(t.icon),
                    selectedIcon: Icon(t.selectedIcon, color: AjiraColors.forest),
                    label: t.label,
                  ),
              ],
            ),
    );
  }
}

class _TabSpec {
  const _TabSpec(this.path, this.label, this.icon, this.selectedIcon);
  final String path;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}
