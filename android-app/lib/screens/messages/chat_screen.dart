import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/client.dart';
import '../../state/auth_controller.dart';
import '../../theme.dart';

final chatProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, projectId) async {
  return ref.watch(apiClientProvider).get('/messages/$projectId');
});

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.projectId});
  final String projectId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(apiClientProvider).post('/messages/${widget.projectId}', data: {'body': text});
      _controller.clear();
      ref.invalidate(chatProvider(widget.projectId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(authControllerProvider).user!.id;
    final chat = ref.watch(chatProvider(widget.projectId));

    return Scaffold(
      appBar: AppBar(
        title: Text(chat.valueOrNull?['projectTitle'] as String? ?? 'Chat'),
      ),
      body: Column(
        children: [
          Expanded(
            child: chat.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('$e')),
              data: (data) {
                final messages = ((data['messages'] as List?) ?? []).cast<Map<String, dynamic>>();
                if (messages.isEmpty) {
                  return const Center(child: Text('Say hello to start the conversation.'));
                }
                return ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(16),
                  itemCount: messages.length,
                  itemBuilder: (_, i) {
                    final m = messages[i];
                    final sender = m['sender'] as Map<String, dynamic>?;
                    final mine = sender?['id'] == me;
                    return Align(
                      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
                        decoration: BoxDecoration(
                          color: mine ? AjiraColors.forest : AjiraColors.panel,
                          borderRadius: BorderRadius.circular(16),
                          border: mine ? null : Border.all(color: AjiraColors.line),
                        ),
                        child: Text(
                          m['body'] as String? ?? '',
                          style: TextStyle(color: mine ? AjiraColors.cream : AjiraColors.ink),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: const InputDecoration(hintText: 'Message'),
                      minLines: 1,
                      maxLines: 4,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _sending ? null : _send,
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
