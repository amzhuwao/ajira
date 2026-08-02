import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../api/client.dart';
import '../../models/models.dart';
import '../../widgets/status_chip.dart';

final browseProvider = FutureProvider.autoDispose.family<List<ProjectCard>, String>((ref, q) async {
  final api = ref.watch(apiClientProvider);
  final data = await api.get('/projects', query: {
    'scope': 'browse',
    if (q.isNotEmpty) 'q': q,
  });
  final list = (data['projects'] as List?) ?? [];
  return list.map((e) => ProjectCard.fromJson(e as Map<String, dynamic>)).toList();
});

class BrowseScreen extends ConsumerStatefulWidget {
  const BrowseScreen({super.key});

  @override
  ConsumerState<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends ConsumerState<BrowseScreen> {
  final _q = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final projects = ref.watch(browseProvider(_query));
    final money = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(title: const Text('Browse projects')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _q,
              decoration: InputDecoration(
                hintText: 'Search projects',
                suffixIcon: IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: () => setState(() => _query = _q.text.trim()),
                ),
              ),
              onSubmitted: (v) => setState(() => _query = v.trim()),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.refresh(browseProvider(_query).future),
              child: projects.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('$e')),
                data: (items) {
                  if (items.isEmpty) {
                    return ListView(children: const [SizedBox(height: 100), Center(child: Text('No open projects'))]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final p = items[i];
                      return Card(
                        child: ListTile(
                          title: Text(p.title),
                          subtitle: Text('${money.format(p.budgetMin)} – ${money.format(p.budgetMax)}'),
                          trailing: StatusChip('${p.bidCount} bids'),
                          onTap: () => context.push('/projects/${p.id}'),
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
