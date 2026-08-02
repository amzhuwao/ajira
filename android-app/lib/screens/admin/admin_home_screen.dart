import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../theme.dart';

final adminSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(apiClientProvider).get('/dashboard/summary');
});

class AdminHomeScreen extends ConsumerWidget {
  const AdminHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(adminSummaryProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(adminSummaryProvider.future),
        child: summary.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [SizedBox(height: 80), Center(child: Text('$e'))]),
          data: (data) {
            final c = (data['counts'] as Map?)?.cast<String, dynamic>() ?? {};
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('Platform overview', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _AdminStat('Users', '${c['users'] ?? 0}'),
                    _AdminStat('Projects', '${c['projects'] ?? 0}'),
                    _AdminStat('Funded', '${c['fundedEscrows'] ?? 0}'),
                    _AdminStat('Disputes', '${c['openDisputes'] ?? 0}'),
                    _AdminStat('Payouts', '${c['pendingWithdrawals'] ?? 0}'),
                  ],
                ),
                const SizedBox(height: 24),
                Text('Quick links', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        title: const Text('Projects'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.go('/projects'),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        title: const Text('Messages'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.go('/messages'),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        title: const Text('More / website admin'),
                        subtitle: const Text('Users, financials, audit, force release'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.go('/more'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Native admin detail screens (force release, payments, audit JSON) ship in the next iteration. Core ops KPIs and navigation are live.',
                  style: TextStyle(color: AjiraColors.inkSoft),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _AdminStat extends StatelessWidget {
  const _AdminStat(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AjiraColors.panel,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AjiraColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 11, color: AjiraColors.inkSoft, letterSpacing: 0.7)),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}
