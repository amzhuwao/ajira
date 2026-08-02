import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../theme.dart';

final talentProvider = FutureProvider.autoDispose.family<List<dynamic>, String>((ref, q) async {
  final data = await ref.watch(apiClientProvider).get('/talent', query: q.isEmpty ? null : {'q': q});
  return (data['sellers'] as List?) ?? [];
});

class TalentScreen extends ConsumerStatefulWidget {
  const TalentScreen({super.key});

  @override
  ConsumerState<TalentScreen> createState() => _TalentScreenState();
}

class _TalentScreenState extends ConsumerState<TalentScreen> {
  final _search = TextEditingController();
  String _q = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sellers = ref.watch(talentProvider(_q));
    return Scaffold(
      appBar: AppBar(title: const Text('Talent')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _search,
              decoration: InputDecoration(
                hintText: 'Search sellers…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: () => setState(() => _q = _search.text.trim()),
                ),
              ),
              onSubmitted: (v) => setState(() => _q = v.trim()),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.refresh(talentProvider(_q).future),
              child: sellers.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [SizedBox(height: 80), Center(child: Text('$e'))]),
                data: (list) {
                  if (list.isEmpty) {
                    return ListView(children: const [
                      SizedBox(height: 80),
                      Center(child: Text('No sellers found')),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final s = (list[i] as Map).cast<String, dynamic>();
                      return Card(
                        child: ListTile(
                          title: Text(s['name']?.toString() ?? ''),
                          subtitle: Text(
                            [
                              if ((s['tagline'] as String?)?.isNotEmpty == true) s['tagline'],
                              '${s['averageRating'] ?? 0}★ · ${s['completedJobs'] ?? 0} jobs',
                            ].join('\n'),
                          ),
                          isThreeLine: (s['tagline'] as String?)?.isNotEmpty == true,
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.push('/talent/${s['id']}'),
                        ),
                      );
                    },
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

final sellerDetailProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.watch(apiClientProvider).get('/talent/$id');
});

class SellerProfileScreen extends ConsumerWidget {
  const SellerProfileScreen({super.key, required this.sellerId});
  final String sellerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(sellerDetailProvider(sellerId));
    return Scaffold(
      appBar: AppBar(title: const Text('Seller')),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) {
          final seller = (data['seller'] as Map?)?.cast<String, dynamic>() ?? {};
          final services = (data['services'] as List?) ?? [];
          final reviews = (data['reviews'] as List?) ?? [];
          final favorited = seller['isFavorite'] == true;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(seller['name']?.toString() ?? '', style: Theme.of(context).textTheme.headlineMedium),
              if ((seller['tagline'] as String?)?.isNotEmpty == true) ...[
                const SizedBox(height: 6),
                Text(seller['tagline'].toString(), style: const TextStyle(color: AjiraColors.inkSoft)),
              ],
              const SizedBox(height: 8),
              Text('${seller['averageRating'] ?? 0}★ · ${seller['reviewCount'] ?? 0} reviews · ${seller['completedJobs'] ?? 0} jobs'),
              if ((seller['bio'] as String?)?.isNotEmpty == true) ...[
                const SizedBox(height: 12),
                Text(seller['bio'].toString()),
              ],
              const SizedBox(height: 16),
              FilledButton.tonal(
                onPressed: () async {
                  try {
                    await ref.read(apiClientProvider).post('/favorites/$sellerId');
                    ref.invalidate(sellerDetailProvider(sellerId));
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(favorited ? 'Removed from favorites' : 'Saved to favorites')),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  }
                },
                child: Text(favorited ? 'Remove favorite' : 'Save favorite'),
              ),
              const SizedBox(height: 24),
              Text('Services', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              if (services.isEmpty) const Text('No active services', style: TextStyle(color: AjiraColors.inkSoft)),
              ...services.map((raw) {
                final s = (raw as Map).cast<String, dynamic>();
                return Card(
                  child: ListTile(
                    title: Text(s['title']?.toString() ?? ''),
                    subtitle: Text('\$${s['price']} · ${s['deliveryDays']} days'),
                  ),
                );
              }),
              const SizedBox(height: 24),
              Text('Reviews', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              if (reviews.isEmpty) const Text('No reviews yet', style: TextStyle(color: AjiraColors.inkSoft)),
              ...reviews.map((raw) {
                final r = (raw as Map).cast<String, dynamic>();
                final reviewer = (r['reviewer'] as Map?)?.cast<String, dynamic>();
                return Card(
                  child: ListTile(
                    title: Text('${r['rating']}★ · ${reviewer?['name'] ?? 'Buyer'}'),
                    subtitle: Text(r['comment']?.toString() ?? ''),
                  ),
                );
              }),
            ],
          );
        },
      ),
    );
  }
}
