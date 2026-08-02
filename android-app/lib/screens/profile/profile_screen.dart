import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/auth_controller.dart';
import '../../theme.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user!;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: AjiraColors.forest,
            child: Text(
              user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
              style: const TextStyle(fontSize: 28, color: AjiraColors.cream),
            ),
          ),
          const SizedBox(height: 16),
          Text(user.name, style: Theme.of(context).textTheme.headlineSmall),
          Text(user.email, style: const TextStyle(color: AjiraColors.inkSoft)),
          const SizedBox(height: 8),
          Text(user.role, style: const TextStyle(fontWeight: FontWeight.w600, color: AjiraColors.forest)),
          if (user.tagline != null) ...[
            const SizedBox(height: 16),
            Text(user.tagline!),
          ],
          if (user.bio != null) ...[
            const SizedBox(height: 8),
            Text(user.bio!, style: const TextStyle(color: AjiraColors.inkSoft)),
          ],
          const SizedBox(height: 24),
          const Text(
            'Full profile editing, services, and KYC continue in upcoming releases. Core marketplace actions already work in-app.',
            style: TextStyle(color: AjiraColors.inkSoft),
          ),
        ],
      ),
    );
  }
}
