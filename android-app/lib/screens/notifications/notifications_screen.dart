import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';

final notificationsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.watch(apiClientProvider).get('/notifications');
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notes = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(apiClientProvider).post('/notifications', data: {'all': true});
              ref.invalidate(notificationsProvider);
            },
            child: const Text('Mark all read', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: notes.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) {
          final items = ((data['notifications'] as List?) ?? []).cast<Map<String, dynamic>>();
          if (items.isEmpty) {
            return const Center(child: Text('You are all caught up.'));
          }
          return ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final n = items[i];
              final unread = n['readAt'] == null;
              return ListTile(
                leading: Icon(unread ? Icons.notifications_active : Icons.notifications_none),
                title: Text(n['title'] as String? ?? '', style: TextStyle(fontWeight: unread ? FontWeight.w700 : FontWeight.w400)),
                subtitle: Text(n['body'] as String? ?? ''),
                onTap: () {
                  final href = n['href'] as String?;
                  if (href != null && href.contains('/projects/')) {
                    final id = href.split('/projects/').last.split('/').first;
                    context.push('/projects/$id');
                  } else if (href != null && href.contains('/messages/')) {
                    final id = href.split('/messages/').last.split('/').first;
                    context.push('/messages/$id');
                  }
                },
              );
            },
          );
        },
      ),
    );
  }
}
