import { PRIORITY_COLORS } from '../types';
import type { Task } from '../types/index';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Calendar, Trash2 } from 'lucide-react';

interface TaskItemProps {
task: Task;
onToggleComplete?: (taskId: string) => void;
onDelete?: (taskId: string) => void;
}

export function TaskItem({ task, onToggleComplete, onDelete }: TaskItemProps) {
const priorityColor = PRIORITY_COLORS[task.priority ?? 'medium'] ?? '';

const handleToggle = () => {
    onToggleComplete?.(task.id);
};

const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete task "${task.title}"?`)) {
      onDelete?.(task.id);
    }
};

return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-md transition-shadow">
   
    <div className="flex items-start gap-2">
        <button
        onClick={handleToggle}
        className="mt-0.5 text-gray-400 hover:text-blue-600 transition-colors"
        >
        {task.completed ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
            <Circle className="h-5 w-5" />
        )}
        </button>

        <div className="flex-1 min-w-0">
        
        <h3
            className={`text-sm font-semibold text-gray-900 ${
            task.completed ? 'line-through text-gray-500' : ''
            }`}
        >
            {task.title}
        </h3>

       
        {task.description && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
            {task.description}
            </p>
        )}

      
        <div className="flex items-center gap-2 mt-2 flex-wrap">

            {task.priority && (
            <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor}`}
            >
                {task.priority}
            </span>
            )}


            {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
                <Calendar className="h-3 w-3" />
                <span>
                {format(task.dueDate, 'MMM d, yyyy')}
                </span>
            </div>
            )}
        </div>
        </div>

        {/* Delete button */}
        <button
        onClick={handleDelete}
        className="text-gray-400 hover:text-red-600 transition-colors ml-2"
        title="Delete task"
        >
        <Trash2 className="h-4 w-4" />
        </button>
    </div>
    </div>
);
}