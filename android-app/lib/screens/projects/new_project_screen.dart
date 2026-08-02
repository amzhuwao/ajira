import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../theme.dart';

class NewProjectScreen extends ConsumerStatefulWidget {
  const NewProjectScreen({super.key});

  @override
  ConsumerState<NewProjectScreen> createState() => _NewProjectScreenState();
}

class _NewProjectScreenState extends ConsumerState<NewProjectScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _min = TextEditingController();
  final _max = TextEditingController();
  final _category = TextEditingController();
  String _timeline = 'FLEXIBLE';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _min.dispose();
    _max.dispose();
    _category.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final data = await ref.read(apiClientProvider).post('/projects', data: {
        'title': _title.text.trim(),
        'description': _description.text.trim(),
        'budgetMin': double.tryParse(_min.text) ?? 0,
        'budgetMax': double.tryParse(_max.text) ?? 0,
        'category': _category.text.trim(),
        'timeline': _timeline,
      });
      final id = (data['project'] as Map)['id'] as String;
      if (mounted) context.go('/projects/$id');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Post a project')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title')),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLines: 6,
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _min,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Budget min'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _max,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Budget max'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(controller: _category, decoration: const InputDecoration(labelText: 'Category')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _timeline,
            items: const [
              DropdownMenuItem(value: 'URGENT', child: Text('Urgent')),
              DropdownMenuItem(value: 'SHORT', child: Text('Short')),
              DropdownMenuItem(value: 'MEDIUM', child: Text('Medium')),
              DropdownMenuItem(value: 'FLEXIBLE', child: Text('Flexible')),
            ],
            onChanged: (v) => setState(() => _timeline = v ?? 'FLEXIBLE'),
            decoration: const InputDecoration(labelText: 'Timeline'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AjiraColors.danger)),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _saving ? null : _submit,
            child: Text(_saving ? 'Posting…' : 'Post project'),
          ),
        ],
      ),
    );
  }
}
