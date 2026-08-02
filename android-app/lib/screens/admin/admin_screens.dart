import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../theme.dart';
import '../../widgets/status_chip.dart';

final adminOverviewProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(apiClientProvider).get('/admin/overview');
});

class AdminHomeScreen extends ConsumerWidget {
  const AdminHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(adminOverviewProvider);
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
        onRefresh: () async => ref.refresh(adminOverviewProvider.future),
        child: overview.when(
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
                    _AdminStat('Held', '\$${c['fundedVolume'] ?? 0}'),
                    _AdminStat('Disputes', '${c['openDisputes'] ?? 0}'),
                    _AdminStat('Payouts', '${c['pendingWithdrawals'] ?? 0}'),
                  ],
                ),
                const SizedBox(height: 24),
                Text('Admin tools', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: [
                      _link(context, 'Users', '/admin/users'),
                      _link(context, 'Escrows', '/admin/escrows'),
                      _link(context, 'Disputes', '/disputes'),
                      _link(context, 'Withdrawals', '/admin/withdrawals'),
                      _link(context, 'Payments', '/admin/payments'),
                      _link(context, 'Financials', '/admin/financials'),
                      _link(context, 'Settings', '/admin/settings'),
                      _link(context, 'Audit log', '/admin/audit', last: true),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _link(BuildContext context, String title, String path, {bool last = false}) {
    return Column(
      children: [
        ListTile(
          title: Text(title),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.push(path),
        ),
        if (!last) const Divider(height: 1),
      ],
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
          Text(label.toUpperCase(),
              style: const TextStyle(fontSize: 11, color: AjiraColors.inkSoft, letterSpacing: 0.7)),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}

final adminUsersProvider = FutureProvider.autoDispose.family<List<dynamic>, String>((ref, q) async {
  final data = await ref.watch(apiClientProvider).get('/admin/users', query: q.isEmpty ? null : {'q': q});
  return (data['users'] as List?) ?? [];
});

class AdminUsersScreen extends ConsumerStatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  ConsumerState<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends ConsumerState<AdminUsersScreen> {
  final _search = TextEditingController();
  String _q = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final users = ref.watch(adminUsersProvider(_q));
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _search,
              decoration: const InputDecoration(
                hintText: 'Search name or email',
                prefixIcon: Icon(Icons.search),
              ),
              onSubmitted: (v) => setState(() => _q = v.trim()),
            ),
          ),
          Expanded(
            child: users.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('$e')),
              data: (list) => ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final u = (list[i] as Map).cast<String, dynamic>();
                  return Card(
                    child: ListTile(
                      title: Text(u['name']?.toString() ?? ''),
                      subtitle: Text('${u['email']} · ${u['role']} · ${u['status']}'),
                      trailing: StatusChip(u['status']?.toString() ?? ''),
                      onTap: () => context.push('/admin/users/${u['id']}'),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final adminUserProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.watch(apiClientProvider).get('/admin/users/$id');
});

class AdminUserDetailScreen extends ConsumerStatefulWidget {
  const AdminUserDetailScreen({super.key, required this.userId});
  final String userId;

  @override
  ConsumerState<AdminUserDetailScreen> createState() => _AdminUserDetailScreenState();
}

class _AdminUserDetailScreenState extends ConsumerState<AdminUserDetailScreen> {
  String? _status;
  String? _role;
  bool? _kyc;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(adminUserProvider(widget.userId));
    return Scaffold(
      appBar: AppBar(title: const Text('User')),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) {
          final u = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};
          _status ??= u['status']?.toString();
          _role ??= u['role']?.toString();
          _kyc ??= u['kycVerified'] == true;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(u['name']?.toString() ?? '', style: Theme.of(context).textTheme.headlineSmall),
              Text(u['email']?.toString() ?? '', style: const TextStyle(color: AjiraColors.inkSoft)),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _role,
                decoration: const InputDecoration(labelText: 'Role'),
                items: const [
                  DropdownMenuItem(value: 'BUYER', child: Text('Buyer')),
                  DropdownMenuItem(value: 'SELLER', child: Text('Seller')),
                  DropdownMenuItem(value: 'ADMIN', child: Text('Admin')),
                ],
                onChanged: (v) => setState(() => _role = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(value: 'ACTIVE', child: Text('Active')),
                  DropdownMenuItem(value: 'SUSPENDED', child: Text('Suspended')),
                  DropdownMenuItem(value: 'BANNED', child: Text('Banned')),
                ],
                onChanged: (v) => setState(() => _status = v),
              ),
              SwitchListTile(
                title: const Text('KYC verified'),
                value: _kyc ?? false,
                onChanged: (v) => setState(() => _kyc = v),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () async {
                        setState(() => _busy = true);
                        try {
                          await ref.read(apiClientProvider).patch(
                            '/admin/users/${widget.userId}',
                            data: {
                              'name': u['name'],
                              'email': u['email'],
                              'role': _role,
                              'status': _status,
                              'kycVerified': _kyc == true,
                              'phone': u['phone'] ?? '',
                            },
                          );
                          ref.invalidate(adminUserProvider(widget.userId));
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('User updated')),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                          }
                        } finally {
                          if (mounted) setState(() => _busy = false);
                        }
                      },
                child: const Text('Save changes'),
              ),
            ],
          );
        },
      ),
    );
  }
}

final adminEscrowsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/admin/escrows');
  return (data['escrows'] as List?) ?? [];
});

class AdminEscrowsScreen extends ConsumerWidget {
  const AdminEscrowsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final escrows = ref.watch(adminEscrowsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Escrows')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(adminEscrowsProvider.future),
        child: escrows.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [Center(child: Text('$e'))]),
          data: (list) => ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final e = (list[i] as Map).cast<String, dynamic>();
              final project = (e['project'] as Map?)?.cast<String, dynamic>();
              final canForce = ['FUNDED', 'RELEASE_REQUESTED', 'REFUND_REQUESTED'].contains(e['status']);
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(project?['title']?.toString() ?? 'Escrow',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text('\$${e['amount']} · ${e['status']}'),
                      if (canForce) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            TextButton(
                              onPressed: () => _force(context, ref, e['id'].toString(), true),
                              child: const Text('Force release'),
                            ),
                            TextButton(
                              onPressed: () => _force(context, ref, e['id'].toString(), false),
                              child: const Text('Force refund'),
                            ),
                            TextButton(
                              onPressed: () => context.push('/escrow/${e['id']}'),
                              child: const Text('Open'),
                            ),
                          ],
                        ),
                      ] else
                        TextButton(
                          onPressed: () => context.push('/escrow/${e['id']}'),
                          child: const Text('Open'),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _force(BuildContext context, WidgetRef ref, String id, bool release) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(release ? 'Force release?' : 'Force refund?'),
        content: Text(release
            ? 'Credit the seller wallet and mark escrow released.'
            : 'Mark escrow refunded. You still need to refund in Paynow.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final path = release ? '/admin/escrows/$id/release' : '/admin/escrows/$id/refund';
      await ref.read(apiClientProvider).post(path, data: {});
      ref.invalidate(adminEscrowsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Done')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }
}

final adminWithdrawalsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/admin/withdrawals');
  return (data['withdrawals'] as List?) ?? [];
});

class AdminWithdrawalsScreen extends ConsumerWidget {
  const AdminWithdrawalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(adminWithdrawalsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Withdrawals')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(adminWithdrawalsProvider.future),
        child: items.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [Center(child: Text('$e'))]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                Center(child: Text('No pending withdrawals')),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final w = (list[i] as Map).cast<String, dynamic>();
                final user = (w['user'] as Map?)?.cast<String, dynamic>();
                return Card(
                  child: ListTile(
                    title: Text('${user?['name']} · \$${w['amount']}'),
                    subtitle: Text('${w['method']} → ${w['destination']}\n${w['status']}'),
                    isThreeLine: true,
                    trailing: PopupMenuButton<String>(
                      onSelected: (decision) async {
                        try {
                          await ref.read(apiClientProvider).post(
                            '/admin/withdrawals/${w['id']}',
                            data: {'decision': decision},
                          );
                          ref.invalidate(adminWithdrawalsProvider);
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                          }
                        }
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(value: 'APPROVED', child: Text('Approve')),
                        PopupMenuItem(value: 'COMPLETED', child: Text('Complete')),
                        PopupMenuItem(value: 'REJECTED', child: Text('Reject')),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

final adminPaymentsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/admin/payments');
  return (data['payments'] as List?) ?? [];
});

class AdminPaymentsScreen extends ConsumerWidget {
  const AdminPaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(adminPaymentsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Payments')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(adminPaymentsProvider.future),
        child: items.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [Center(child: Text('$e'))]),
          data: (list) => ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final p = (list[i] as Map).cast<String, dynamic>();
              final project = (p['project'] as Map?)?.cast<String, dynamic>();
              return Card(
                child: ListTile(
                  title: Text(project?['title']?.toString() ?? p['merchantReference']?.toString() ?? ''),
                  subtitle: Text('\$${p['amount']} · ${p['channel']} · ${p['status']}'),
                  trailing: StatusChip(p['status']?.toString() ?? ''),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

final adminFinancialsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(apiClientProvider).get('/admin/financials');
});

class AdminFinancialsScreen extends ConsumerWidget {
  const AdminFinancialsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(adminFinancialsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Financials')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(adminFinancialsProvider.future),
        child: data.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [Center(child: Text('$e'))]),
          data: (f) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _row('Released volume', '\$${f['releasedVolume']} (${f['releasedCount']} escrows)'),
              _row('Platform fees', '\$${f['totalFees']}'),
              _row('Seller wallet balances', '\$${f['walletBalances']}'),
              _row('Pending wallet', '\$${f['pendingWalletBalances']}'),
              _row('Pending withdrawals',
                  '\$${f['pendingWithdrawalAmount']} (${f['pendingWithdrawalCount']})'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Card(
      child: ListTile(title: Text(label), subtitle: Text(value)),
    );
  }
}

final adminSettingsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(apiClientProvider).get('/admin/settings');
});

class AdminSettingsScreen extends ConsumerStatefulWidget {
  const AdminSettingsScreen({super.key});

  @override
  ConsumerState<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends ConsumerState<AdminSettingsScreen> {
  final _commission = TextEditingController();
  final _minEscrow = TextEditingController();
  final _autoRelease = TextEditingController();
  bool _loaded = false;
  bool _busy = false;
  Map<String, dynamic> _settings = {};

  @override
  void dispose() {
    _commission.dispose();
    _minEscrow.dispose();
    _autoRelease.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(adminSettingsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: settings.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) {
          if (!_loaded) {
            _settings = (data['settings'] as Map?)?.cast<String, dynamic>() ?? {};
            _commission.text = '${_settings['commission_percentage'] ?? 10}';
            _minEscrow.text = '${_settings['min_escrow_amount'] ?? 5}';
            _autoRelease.text = '${_settings['auto_release_days'] ?? 14}';
            _loaded = true;
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextField(
                controller: _commission,
                decoration: const InputDecoration(labelText: 'Commission %'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _minEscrow,
                decoration: const InputDecoration(labelText: 'Min escrow amount'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _autoRelease,
                decoration: const InputDecoration(labelText: 'Auto-release days'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () async {
                        setState(() => _busy = true);
                        try {
                          final payload = Map<String, dynamic>.from(_settings);
                          payload['commission_percentage'] = _commission.text;
                          payload['min_escrow_amount'] = _minEscrow.text;
                          payload['auto_release_days'] = _autoRelease.text;
                          await ref.read(apiClientProvider).put('/admin/settings', data: payload);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Settings saved')),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                          }
                        } finally {
                          if (mounted) setState(() => _busy = false);
                        }
                      },
                child: const Text('Save'),
              ),
            ],
          );
        },
      ),
    );
  }
}

final adminAuditProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/admin/audit');
  return (data['logs'] as List?) ?? [];
});

class AdminAuditScreen extends ConsumerWidget {
  const AdminAuditScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(adminAuditProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Audit log')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(adminAuditProvider.future),
        child: logs.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [Center(child: Text('$e'))]),
          data: (list) => ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final l = (list[i] as Map).cast<String, dynamic>();
              final admin = (l['admin'] as Map?)?.cast<String, dynamic>();
              return Card(
                child: ListTile(
                  title: Text(l['summary']?.toString() ?? l['action']?.toString() ?? ''),
                  subtitle: Text('${admin?['name'] ?? 'Admin'} · ${l['action']} · ${l['createdAt']}'),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
