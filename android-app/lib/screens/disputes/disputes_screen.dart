import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../state/auth_controller.dart';
import '../../theme.dart';
import '../../widgets/status_chip.dart';

final disputesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/disputes');
  return (data['disputes'] as List?) ?? [];
});

class DisputesScreen extends ConsumerWidget {
  const DisputesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final disputes = ref.watch(disputesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Disputes')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(disputesProvider.future),
        child: disputes.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [SizedBox(height: 80), Center(child: Text('$e'))]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                Center(child: Text('No disputes', style: TextStyle(color: AjiraColors.inkSoft))),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final d = (list[i] as Map).cast<String, dynamic>();
                final escrow = (d['escrow'] as Map?)?.cast<String, dynamic>() ?? {};
                final project = (escrow['project'] as Map?)?.cast<String, dynamic>();
                return Card(
                  child: ListTile(
                    title: Text(project?['title']?.toString() ?? 'Dispute'),
                    subtitle: Text('\$${escrow['amount'] ?? 0} · ${d['status']}'),
                    trailing: StatusChip(d['status']?.toString() ?? ''),
                    onTap: () => context.push('/disputes/${d['id']}'),
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

final disputeDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.watch(apiClientProvider).get('/disputes/$id');
});

class DisputeDetailScreen extends ConsumerStatefulWidget {
  const DisputeDetailScreen({super.key, required this.disputeId});
  final String disputeId;

  @override
  ConsumerState<DisputeDetailScreen> createState() => _DisputeDetailScreenState();
}

class _DisputeDetailScreenState extends ConsumerState<DisputeDetailScreen> {
  final _message = TextEditingController();
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _message.dispose();
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(disputeDetailProvider(widget.disputeId));
    final isAdmin = ref.watch(authControllerProvider).user?.isAdmin == true;

    return Scaffold(
      appBar: AppBar(title: const Text('Dispute')),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) {
          final d = (data['dispute'] as Map?)?.cast<String, dynamic>() ?? {};
          final escrow = (d['escrow'] as Map?)?.cast<String, dynamic>() ?? {};
          final project = (escrow['project'] as Map?)?.cast<String, dynamic>();
          final messages = (d['messages'] as List?) ?? [];
          final open = d['status'] == 'OPEN' || d['status'] == 'UNDER_REVIEW';

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(project?['title']?.toString() ?? 'Dispute',
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 8),
                    StatusChip(d['status']?.toString() ?? ''),
                    const SizedBox(height: 8),
                    Text('\$${escrow['amount'] ?? 0} · ${escrow['status']}'),
                    const SizedBox(height: 12),
                    Text(d['reason']?.toString() ?? ''),
                    if ((d['resolution'] as String?)?.isNotEmpty == true) ...[
                      const SizedBox(height: 12),
                      Text('Resolution: ${d['resolution']}', style: const TextStyle(color: AjiraColors.inkSoft)),
                    ],
                    const SizedBox(height: 20),
                    Text('Thread', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    ...messages.map((raw) {
                      final m = (raw as Map).cast<String, dynamic>();
                      final author = (m['author'] as Map?)?.cast<String, dynamic>();
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Card(
                          child: ListTile(
                            title: Text(author?['name']?.toString() ?? 'User'),
                            subtitle: Text(m['body']?.toString() ?? ''),
                          ),
                        ),
                      );
                    }),
                    if (isAdmin && open) ...[
                      const SizedBox(height: 16),
                      TextField(
                        controller: _note,
                        decoration: const InputDecoration(labelText: 'Resolution note'),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: _busy ? null : () => _resolve('RELEASE'),
                              child: const Text('Release to seller'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _busy ? null : () => _resolve('REFUND'),
                              child: const Text('Refund buyer'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (open)
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _message,
                            decoration: const InputDecoration(hintText: 'Add a message…'),
                          ),
                        ),
                        IconButton(
                          onPressed: _busy ? null : _sendMessage,
                          icon: const Icon(Icons.send),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _sendMessage() async {
    final body = _message.text.trim();
    if (body.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).post(
        '/disputes/${widget.disputeId}/messages',
        data: {'body': body},
      );
      _message.clear();
      ref.invalidate(disputeDetailProvider(widget.disputeId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resolve(String resolution) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).post(
        '/admin/disputes/${widget.disputeId}/resolve',
        data: {
          'resolution': resolution,
          'note': _note.text.trim().isEmpty ? 'Resolved via app' : _note.text.trim(),
        },
      );
      ref.invalidate(disputeDetailProvider(widget.disputeId));
      ref.invalidate(disputesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Dispute resolved ($resolution)')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
