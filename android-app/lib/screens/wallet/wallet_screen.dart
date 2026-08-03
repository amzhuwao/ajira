import 'package:flutter/material.dart';
import 'package:flutter_custom_tabs/flutter_custom_tabs.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../api/client.dart';
import '../../state/auth_controller.dart';
import '../../theme.dart';
import '../../widgets/status_chip.dart';

final walletProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(apiClientProvider).get('/wallet');
});

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  final _amount = TextEditingController();
  final _destination = TextEditingController();
  final _topUpAmount = TextEditingController();
  final _phone = TextEditingController();
  String _method = 'ECOCASH';
  String _topUpChannel = 'WEB';
  bool _submitting = false;

  @override
  void dispose() {
    _amount.dispose();
    _destination.dispose();
    _topUpAmount.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _withdraw() async {
    setState(() => _submitting = true);
    try {
      await ref.read(apiClientProvider).post('/wallet/withdraw', data: {
        'amount': double.tryParse(_amount.text) ?? 0,
        'method': _method,
        'destination': _destination.text.trim(),
      });
      _amount.clear();
      _destination.clear();
      ref.invalidate(walletProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Withdrawal requested')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _topUp() async {
    setState(() => _submitting = true);
    try {
      final data = await ref.read(apiClientProvider).post('/wallet/top-up', data: {
        'amount': double.tryParse(_topUpAmount.text) ?? 0,
        'channel': _topUpChannel,
        if (_topUpChannel != 'WEB') 'phone': _phone.text.trim(),
      });
      final redirect = data['redirectUrl'] as String?;
      final topUpId = data['topUpId'] as String?;
      if (redirect != null) {
        await launchUrl(
          Uri.parse(redirect),
          customTabsOptions: CustomTabsOptions(
            colorSchemes: CustomTabsColorSchemes.defaults(
              toolbarColor: AjiraColors.forest,
            ),
            urlBarHidingEnabled: true,
            showTitle: true,
          ),
        );
      }
      if (topUpId != null && redirect == null) {
        // Mobile money — poll after user confirms
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(data['instructions'] as String? ?? 'Complete payment on your phone')),
          );
        }
      }
      ref.invalidate(walletProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final wallet = ref.watch(walletProvider);
    final user = ref.watch(authControllerProvider).user;
    final money = NumberFormat.simpleCurrency(name: 'USD');
    final isBuyer = user?.isBuyer == true || user?.isAdmin == true;
    final isSeller = user?.isSeller == true || user?.isAdmin == true;

    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(walletProvider.future),
        child: wallet.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [SizedBox(height: 80), Center(child: Text('$e'))]),
          data: (data) {
            final w = data['wallet'] as Map<String, dynamic>? ?? {};
            final txns = ((data['transactions'] as List?) ?? []).cast<Map<String, dynamic>>();
            final totalSpent = (data['totalSpent'] as num?)?.toDouble() ?? 0;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AjiraColors.forest, AjiraColors.forestDeep],
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isBuyer && !isSeller ? 'Prepaid balance' : 'Available balance',
                        style: const TextStyle(color: AjiraColors.cream),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        money.format((w['balance'] as num?)?.toDouble() ?? 0),
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: AjiraColors.cream),
                      ),
                      if (isBuyer) ...[
                        const SizedBox(height: 12),
                        Text(
                          'Spent from wallet: ${money.format(totalSpent)}',
                          style: const TextStyle(color: AjiraColors.cream),
                        ),
                      ],
                    ],
                  ),
                ),
                if (isBuyer) ...[
                  const SizedBox(height: 24),
                  Text('Add funds', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _topUpAmount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Amount (USD)'),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: _topUpChannel,
                    items: const [
                      DropdownMenuItem(value: 'WEB', child: Text('Paynow web')),
                      DropdownMenuItem(value: 'ECOCASH', child: Text('Ecocash')),
                      DropdownMenuItem(value: 'ONEMONEY', child: Text('OneMoney')),
                    ],
                    onChanged: (v) => setState(() => _topUpChannel = v ?? 'WEB'),
                    decoration: const InputDecoration(labelText: 'Method'),
                  ),
                  if (_topUpChannel != 'WEB') ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: _phone,
                      decoration: const InputDecoration(labelText: 'Phone'),
                    ),
                  ],
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _submitting ? null : _topUp,
                    child: Text(_submitting ? 'Starting…' : 'Top up'),
                  ),
                ],
                if (isSeller && user?.isBuyer != true) ...[
                  const SizedBox(height: 24),
                  Text('Request withdrawal', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _amount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Amount'),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: _method,
                    items: const [
                      DropdownMenuItem(value: 'ECOCASH', child: Text('Ecocash')),
                      DropdownMenuItem(value: 'ONEMONEY', child: Text('OneMoney')),
                      DropdownMenuItem(value: 'BANK', child: Text('Bank')),
                    ],
                    onChanged: (v) => setState(() => _method = v ?? 'ECOCASH'),
                    decoration: const InputDecoration(labelText: 'Method'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _destination,
                    decoration: const InputDecoration(labelText: 'Phone / account'),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _submitting ? null : _withdraw,
                    child: Text(_submitting ? 'Submitting…' : 'Request payout'),
                  ),
                ],
                const SizedBox(height: 28),
                Text(
                  isBuyer ? 'Spending & activity' : 'Recent activity',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                if (txns.isEmpty)
                  const Text('No activity yet', style: TextStyle(color: AjiraColors.inkSoft)),
                ...txns.map((t) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(t['description'] as String? ?? t['type'] as String? ?? ''),
                      subtitle: Text(t['createdAt'] as String? ?? ''),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(money.format((t['amount'] as num?)?.toDouble() ?? 0)),
                          StatusChip(t['type'] as String? ?? ''),
                        ],
                      ),
                    )),
              ],
            );
          },
        ),
      ),
    );
  }
}
