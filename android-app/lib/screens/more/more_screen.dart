import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config.dart';
import '../../state/auth_controller.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user!;
    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.person_outline),
            title: const Text('Profile'),
            onTap: () => context.push('/profile'),
          ),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Notifications'),
            onTap: () => context.push('/notifications'),
          ),
          if (user.isBuyer || user.isAdmin) ...[
            ListTile(
              leading: const Icon(Icons.people_outline),
              title: const Text('Talent'),
              onTap: () => context.push('/talent'),
            ),
            ListTile(
              leading: const Icon(Icons.storefront_outlined),
              title: const Text('Service catalog'),
              onTap: () => context.push('/catalog'),
            ),
            ListTile(
              leading: const Icon(Icons.favorite_outline),
              title: const Text('Favorites'),
              onTap: () => context.push('/favorites'),
            ),
          ],
          if (user.isSeller)
            ListTile(
              leading: const Icon(Icons.storefront_outlined),
              title: const Text('Service catalog'),
              onTap: () => context.push('/catalog'),
            ),
          ListTile(
            leading: const Icon(Icons.gavel_outlined),
            title: const Text('Disputes'),
            onTap: () => context.push('/disputes'),
          ),
          if (user.isSeller)
            ListTile(
              leading: const Icon(Icons.account_balance_wallet_outlined),
              title: const Text('Wallet'),
              onTap: () => context.go('/wallet'),
            ),
          if (user.isAdmin)
            ListTile(
              leading: const Icon(Icons.admin_panel_settings_outlined),
              title: const Text('Admin home'),
              onTap: () => context.go('/admin'),
            ),
          ListTile(
            leading: const Icon(Icons.open_in_browser),
            title: const Text('Open full website'),
            onTap: () => launchUrl(
              Uri.parse('$kApiBase/dashboard'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Log out'),
            onTap: () async {
              await ref.read(authControllerProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}
