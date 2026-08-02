import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../api/client.dart';
import '../../state/auth_controller.dart';
import '../../theme.dart';
import '../../widgets/status_chip.dart';

final projectDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.watch(apiClientProvider).get('/projects/$id');
});

class ProjectDetailScreen extends ConsumerStatefulWidget {
  const ProjectDetailScreen({super.key, required this.projectId});
  final String projectId;

  @override
  ConsumerState<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends ConsumerState<ProjectDetailScreen> {
  final _amount = TextEditingController();
  final _proposal = TextEditingController();
  final _days = TextEditingController(text: '7');
  bool _bidding = false;

  @override
  void dispose() {
    _amount.dispose();
    _proposal.dispose();
    _days.dispose();
    super.dispose();
  }

  Future<void> _placeBid() async {
    setState(() => _bidding = true);
    try {
      await ref.read(apiClientProvider).post('/bids', data: {
        'projectId': widget.projectId,
        'amount': double.tryParse(_amount.text) ?? 0,
        'proposal': _proposal.text.trim(),
        'deliveryDays': int.tryParse(_days.text) ?? 7,
      });
      ref.invalidate(projectDetailProvider(widget.projectId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bid submitted')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _bidding = false);
    }
  }

  Future<void> _accept(String bidId) async {
    try {
      final data = await ref.read(apiClientProvider).post('/bids/$bidId/accept');
      ref.invalidate(projectDetailProvider(widget.projectId));
      final escrowId = data['escrowId'] as String?;
      if (escrowId != null && mounted) {
        context.push('/escrow/$escrowId');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user!;
    final detail = ref.watch(projectDetailProvider(widget.projectId));
    final money = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(title: const Text('Project')),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) {
          final p = data['project'] as Map<String, dynamic>;
          final escrow = p['escrow'] as Map<String, dynamic>?;
          final bids = (p['bids'] as List?) ?? [];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(p['title'] as String? ?? '', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Row(
                children: [
                  StatusChip(p['status'] as String? ?? ''),
                  const SizedBox(width: 8),
                  Text(
                    '${money.format((p['budgetMin'] as num?)?.toDouble() ?? 0)} – ${money.format((p['budgetMax'] as num?)?.toDouble() ?? 0)}',
                    style: const TextStyle(color: AjiraColors.inkSoft),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(p['description'] as String? ?? ''),
              if (escrow != null) ...[
                const SizedBox(height: 20),
                Card(
                  child: ListTile(
                    title: const Text('Escrow'),
                    subtitle: Text('${escrow['status']} · ${money.format((escrow['amount'] as num?)?.toDouble() ?? 0)}'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/escrow/${escrow['id']}'),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => context.push('/messages/${widget.projectId}'),
                icon: const Icon(Icons.chat_bubble_outline),
                label: const Text('Open messages'),
              ),
              if (user.isSeller && p['status'] == 'OPEN') ...[
                const SizedBox(height: 24),
                Text('Place a bid', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                TextField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount (USD)'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _days,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Delivery days'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _proposal,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: 'Proposal'),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _bidding ? null : _placeBid,
                  child: Text(_bidding ? 'Submitting…' : 'Submit bid'),
                ),
              ],
              if ((user.isBuyer || user.isAdmin) && bids.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text('Bids', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                ...bids.map((raw) {
                  final b = raw as Map<String, dynamic>;
                  final seller = b['seller'] as Map<String, dynamic>?;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(seller?['name'] as String? ?? 'Seller'),
                      subtitle: Text(
                        '${money.format((b['amount'] as num?)?.toDouble() ?? 0)} · ${b['deliveryDays']} days\n${b['proposal'] ?? ''}',
                      ),
                      isThreeLine: true,
                      trailing: b['status'] == 'PENDING' && user.isBuyer
                          ? TextButton(
                              onPressed: () => _accept(b['id'] as String),
                              child: const Text('Accept'),
                            )
                          : StatusChip(b['status'] as String? ?? ''),
                    ),
                  );
                }),
              ],
            ],
          );
        },
      ),
    );
  }
}
