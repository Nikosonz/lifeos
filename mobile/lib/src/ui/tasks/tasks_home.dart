import 'package:flutter/material.dart';

import 'labels_tab.dart';
import 'projects_tab.dart';
import 'tasks_tab.dart';

/// Tasks module home — three tabs mirroring the web's Tasks/Projects/Labels
/// sidebar entries.
class TasksHomeScreen extends StatelessWidget {
  const TasksHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Material(
            color: Colors.transparent,
            child: TabBar(
              tabs: [
                Tab(text: 'وظایف'),
                Tab(text: 'پروژه‌ها'),
                Tab(text: 'برچسب‌ها'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [TasksTab(), ProjectsTab(), LabelsTab()],
            ),
          ),
        ],
      ),
    );
  }
}
