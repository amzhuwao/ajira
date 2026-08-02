import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../api/client.dart';
import '../../state/auth_controller.dart';
import '../../theme.dart';
import '../../widgets/status_chip.dart';

final homeSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  return api.get('/dashboard/summary');
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user!;
    final summary = ref.watch(homeSummaryProvider);
    final money = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(
        title: Text(user.isSeller ? 'Seller home' : 'Buyer home'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(homeSummaryProvider.future),
        child: summary.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 80),
              Center(child: Text('$e')),
              TextButton(onPressed: () => ref.refresh(homeSummaryProvider), child: const Text('Retry')),
            ],
          ),
          data: (data) {
            final counts = (data['counts'] as Map?)?.cast<String, dynamic>() ?? {};
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Hello, ${user.name.split(' ').first}',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  user.isSeller
                      ? 'Find work and manage your wallet.'
                      : 'Post projects and track escrow.',
                  style: TextStyle(color: AjiraColors.inkSoft),
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    if (user.isBuyer) ...[
                      _StatCard(label: 'Projects', value: '${counts['projects'] ?? 0}'),
                      _StatCard(label: 'Disputes', value: '${counts['openDisputes'] ?? 0}'),
                      _StatCard(label: 'Alerts', value: '${counts['unreadNotifications'] ?? 0}'),
                    ],
                    if (user.isSeller) ...[
                      _StatCard(label: 'Open jobs', value: '${counts['openProjects'] ?? 0}'),
                      _StatCard(
                        label: 'Balance',
                        value: money.format((counts['walletBalance'] as num?)?.toDouble() ?? 0),
                      ),
                      _StatCard(label: 'Alerts', value: '${counts['unreadNotifications'] ?? 0}'),
                    ],
                  ],
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => context.push(user.isBuyer ? '/projects/new' : '/browse'),
                        icon: Icon(user.isBuyer ? Icons.add : Icons.search),
                        label: Text(user.isBuyer ? 'Post project' : 'Browse projects'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 28),
                Text('Recent activity', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (user.isBuyer)
                  ...((data['recentProjects'] as List?) ?? []).map((raw) {
                    final p = raw as Map<String, dynamic>;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        title: Text(p['title'] as String? ?? ''),
                        subtitle: Text(
                          '${money.format((p['budgetMin'] as num?)?.toDouble() ?? 0)} – ${money.format((p['budgetMax'] as num?)?.toDouble() ?? 0)}',
                        ),
                        trailing: StatusChip(p['status'] as String? ?? ''),
                        onTap: () => context.push('/projects/${p['id']}'),
                      ),
                    );
                  }),
                if (user.isSeller)
                  ...((data['recentBids'] as List?) ?? []).map((raw) {
                    final b = raw as Map<String, dynamic>;
                    final project = b['project'] as Map<String, dynamic>?;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        title: Text(project?['title'] as String? ?? 'Bid'),
                        subtitle: Text(money.format((b['amount'] as num?)?.toDouble() ?? 0)),
                        trailing: StatusChip(b['status'] as String? ?? ''),
                        onTap: () {
                          final id = project?['id'];
                          if (id != null) context.push('/projects/$id');
                        },
                      ),
                    );
                  }),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AjiraColors.panel,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AjiraColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 11, letterSpacing: 0.8, color: AjiraColors.inkSoft)),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}
