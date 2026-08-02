import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../api/client.dart';
import '../../models/models.dart';
import '../../state/auth_controller.dart';
import '../../widgets/status_chip.dart';

final projectsProvider = FutureProvider.autoDispose<List<ProjectCard>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final data = await api.get('/projects', query: {'scope': 'mine'});
  final list = (data['projects'] as List?) ?? [];
  return list.map((e) => ProjectCard.fromJson(e as Map<String, dynamic>)).toList();
});

class ProjectsScreen extends ConsumerWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user!;
    final projects = ref.watch(projectsProvider);
    final money = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(
        title: Text(user.isAdmin ? 'All projects' : 'My projects'),
        actions: [
          if (user.isBuyer)
            IconButton(
              icon: const Icon(Icons.add),
              onPressed: () => context.push('/projects/new'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(projectsProvider.future),
        child: projects.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('$e')),
          data: (items) {
            if (items.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No projects yet.')),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final p = items[i];
                return Card(
                  child: ListTile(
                    title: Text(p.title),
                    subtitle: Text(
                      '${money.format(p.budgetMin)} – ${money.format(p.budgetMax)} · ${p.bidCount} bids',
                    ),
                    trailing: StatusChip(p.status),
                    onTap: () => context.push('/projects/${p.id}'),
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: user.isBuyer
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/projects/new'),
              icon: const Icon(Icons.add),
              label: const Text('Post'),
            )
          : null,
    );
  }
}
