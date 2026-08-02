import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';

final conversationsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final data = await ref.watch(apiClientProvider).get('/messages');
  return ((data['conversations'] as List?) ?? []).cast<Map<String, dynamic>>();
});

class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final convos = ref.watch(conversationsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(conversationsProvider.future),
        child: convos.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('$e')),
          data: (items) {
            if (items.isEmpty) {
              return ListView(children: const [SizedBox(height: 120), Center(child: Text('No conversations yet'))]);
            }
            return ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final c = items[i];
                final last = c['lastMessage'] as Map<String, dynamic>?;
                return ListTile(
                  title: Text(c['projectTitle'] as String? ?? 'Project'),
                  subtitle: Text(last?['body'] as String? ?? 'No messages yet', maxLines: 1, overflow: TextOverflow.ellipsis),
                  onTap: () => context.push('/messages/${c['projectId']}'),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
