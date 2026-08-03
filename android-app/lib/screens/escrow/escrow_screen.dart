import 'package:flutter/material.dart';
import 'package:flutter_custom_tabs/flutter_custom_tabs.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../api/client.dart';
import '../../state/auth_controller.dart';
import '../../theme.dart';
import '../../widgets/status_chip.dart';

final escrowProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.watch(apiClientProvider).get('/escrows/$id');
});

class EscrowScreen extends ConsumerStatefulWidget {
  const EscrowScreen({super.key, required this.escrowId});
  final String escrowId;

  @override
  ConsumerState<EscrowScreen> createState() => _EscrowScreenState();
}

class _EscrowScreenState extends ConsumerState<EscrowScreen> {
  String _channel = 'WEB';
  final _phone = TextEditingController();
  bool _busy = false;
  String? _instructions;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _fund() async {
    setState(() {
      _busy = true;
      _instructions = null;
    });
    try {
      final data = await ref.read(apiClientProvider).post(
        '/escrows/${widget.escrowId}/fund',
        data: {
          'escrowId': widget.escrowId,
          'channel': _channel,
          if (_channel != 'WEB') 'phone': _phone.text.trim(),
        },
      );

      if (data['redirectUrl'] is String) {
        await launchUrl(
          Uri.parse(data['redirectUrl'] as String),
          customTabsOptions: CustomTabsOptions(
            colorSchemes: CustomTabsColorSchemes.defaults(
              toolbarColor: AjiraColors.forest,
            ),
            urlBarHidingEnabled: true,
            showTitle: true,
          ),
        );
      } else {
        setState(() => _instructions = data['instructions'] as String?);
        final paymentId = data['paymentId'] as String?;
        if (paymentId != null) {
          await _poll(paymentId);
        }
      }
      ref.invalidate(escrowProvider(widget.escrowId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _poll(String paymentId) async {
    for (var i = 0; i < 12; i++) {
      await Future<void>.delayed(const Duration(seconds: 3));
      final data = await ref.read(apiClientProvider).post('/payments/$paymentId/poll');
      if (data['status'] == 'PAID') {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Payment confirmed')),
          );
        }
        ref.invalidate(escrowProvider(widget.escrowId));
        return;
      }
    }
  }

  Future<void> _fundFromWallet() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).post('/escrows/${widget.escrowId}/fund-wallet');
      ref.invalidate(escrowProvider(widget.escrowId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Escrow funded from wallet')),
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

  Future<void> _approve() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).post('/escrows/${widget.escrowId}/approve');
      ref.invalidate(escrowProvider(widget.escrowId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Funds released')),
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

  Future<void> _deliver(String projectId) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).post('/projects/$projectId/deliver');
      ref.invalidate(escrowProvider(widget.escrowId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user!;
    final escrowAsync = ref.watch(escrowProvider(widget.escrowId));
    final money = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(title: const Text('Escrow')),
      body: escrowAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) {
          final e = data['escrow'] as Map<String, dynamic>;
          final project = e['project'] as Map<String, dynamic>?;
          final status = e['status'] as String? ?? '';
          final isBuyer = user.id == (e['buyer'] as Map?)?['id'] || user.isAdmin;
          final isSeller = user.id == (e['seller'] as Map?)?['id'];

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(project?['title'] as String? ?? 'Escrow', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Row(
                children: [
                  StatusChip(status),
                  const SizedBox(width: 12),
                  Text(money.format((e['amount'] as num?)?.toDouble() ?? 0)),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '${(e['buyer'] as Map?)?['name'] ?? 'Buyer'} → ${(e['seller'] as Map?)?['name'] ?? 'Seller'}',
                style: const TextStyle(color: AjiraColors.inkSoft),
              ),
              if (status == 'PENDING' && isBuyer) ...[
                const SizedBox(height: 24),
                Text('Fund escrow', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _busy ? null : _fundFromWallet,
                  child: const Text('Fund from wallet'),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Or pay with Paynow. Web checkout opens in a secure in-app browser.',
                  style: TextStyle(color: AjiraColors.inkSoft),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _channel,
                  items: const [
                    DropdownMenuItem(value: 'WEB', child: Text('Paynow web / card')),
                    DropdownMenuItem(value: 'ECOCASH', child: Text('Ecocash')),
                    DropdownMenuItem(value: 'ONEMONEY', child: Text('OneMoney')),
                  ],
                  onChanged: (v) => setState(() => _channel = v ?? 'WEB'),
                  decoration: const InputDecoration(labelText: 'Channel'),
                ),
                if (_channel != 'WEB') ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Mobile money phone'),
                  ),
                ],
                if (_instructions != null) ...[
                  const SizedBox(height: 12),
                  Text(_instructions!, style: const TextStyle(color: AjiraColors.forestDeep)),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy ? null : _fund,
                  child: Text(_busy ? 'Starting…' : 'Pay now'),
                ),
              ],
              if (status == 'FUNDED' && isSeller) ...[
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _busy || project?['id'] == null
                      ? null
                      : () => _deliver(project!['id'] as String),
                  child: const Text('Mark work delivered'),
                ),
              ],
              if ((status == 'FUNDED' || status == 'RELEASE_REQUESTED') && isBuyer) ...[
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _busy ? null : _approve,
                  child: const Text('Approve & release funds'),
                ),
              ],
              const SizedBox(height: 24),
              TextButton(
                onPressed: () => ref.refresh(escrowProvider(widget.escrowId)),
                child: const Text('Refresh status'),
              ),
            ],
          );
        },
      ),
    );
  }
}
