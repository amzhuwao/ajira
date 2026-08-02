import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../theme.dart';

final catalogProvider = FutureProvider.autoDispose.family<List<dynamic>, String>((ref, q) async {
  final data = await ref.watch(apiClientProvider).get('/catalog', query: q.isEmpty ? null : {'q': q});
  return (data['services'] as List?) ?? [];
});

class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key});

  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  final _search = TextEditingController();
  String _q = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final services = ref.watch(catalogProvider(_q));
    return Scaffold(
      appBar: AppBar(title: const Text('Catalog')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _search,
              decoration: InputDecoration(
                hintText: 'Search services…',
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
              onRefresh: () async => ref.refresh(catalogProvider(_q).future),
              child: services.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [SizedBox(height: 80), Center(child: Text('$e'))]),
                data: (list) {
                  if (list.isEmpty) {
                    return ListView(children: const [
                      SizedBox(height: 80),
                      Center(child: Text('No services found')),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final s = (list[i] as Map).cast<String, dynamic>();
                      final seller = (s['seller'] as Map?)?.cast<String, dynamic>();
                      return Card(
                        child: ListTile(
                          title: Text(s['title']?.toString() ?? ''),
                          subtitle: Text(
                            '${seller?['name'] ?? 'Seller'} · \$${s['price']} · ${s['deliveryDays']} days\n${s['description'] ?? ''}',
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                          ),
                          isThreeLine: true,
                          onTap: seller?['id'] != null
                              ? () => context.push('/talent/${seller!['id']}')
                              : null,
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

final favoritesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/favorites');
  return (data['favorites'] as List?) ?? [];
});

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favs = ref.watch(favoritesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Favorites')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(favoritesProvider.future),
        child: favs.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [SizedBox(height: 80), Center(child: Text('$e'))]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                Center(child: Text('No favorites yet', style: TextStyle(color: AjiraColors.inkSoft))),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final f = (list[i] as Map).cast<String, dynamic>();
                final s = (f['seller'] as Map?)?.cast<String, dynamic>() ?? {};
                return Card(
                  child: ListTile(
                    title: Text(s['name']?.toString() ?? ''),
                    subtitle: Text(s['tagline']?.toString() ?? '${s['averageRating'] ?? 0}★'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/talent/${s['id']}'),
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
