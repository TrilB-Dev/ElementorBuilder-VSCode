import * as React from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { getElementorIconOptions, normalizeElementorIconClass } from './elementorIcons';

if (typeof window !== 'undefined') {
  try {
    require('./assets/elementor-icons-5.53.0/css/elementor-icons.css');
  } catch {
    try {
      require('../../src/webview/assets/elementor-icons-5.53.0/css/elementor-icons.css');
    } catch {
      // Ignore asset resolution issues outside the browser bundle.
    }
  }
}

export type ElementorIconPickerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  size?: 'sm' | 'lg';
};

export const ElementorIconPicker: React.FC<ElementorIconPickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'eicon-text',
  id,
  className,
  size,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const normalizedValue = normalizeElementorIconClass(value);
  const iconOptions = React.useMemo(() => getElementorIconOptions(), []);

  const filteredOptions = React.useMemo(() => {
    const searchValue = debouncedQuery.toLowerCase();

    if (!searchValue) {
      return iconOptions;
    }

    return iconOptions.filter((icon) => {
      const compactName = icon.replace(/^eicon-/, '').toLowerCase();
      return icon.toLowerCase().includes(searchValue) || compactName.includes(searchValue);
    });
  }, [iconOptions, debouncedQuery]);

  const handleSelect = (nextValue: string) => {
    onChange(normalizeElementorIconClass(nextValue));
    setIsOpen(false);
    setQuery('');
  };

  return (
    <Form.Group className={className}>
      {label && <Form.Label>{label}</Form.Label>}
      <InputGroup size={size}>
        <Button
          type="button"
          variant="outline-secondary"
          aria-label="Choose Elementor icon"
          onClick={() => setIsOpen((current) => !current)}
          style={{ width: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span className={normalizedValue} aria-hidden="true" style={{ fontSize: size === 'sm' ? '1rem' : '1.2rem' }} />
        </Button>
        <Form.Control
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputGroup>

      {isOpen && (
        <div className="border rounded mt-2 p-2 bg-body" style={{ maxHeight: '260px', overflowY: 'auto' }}>
          <Form.Control
            type="text"
            value={query}
            placeholder="Search icons"
            onChange={(event) => setQuery(event.target.value)}
            className="mb-2"
          />

          <div className="d-flex flex-wrap gap-2">
            {filteredOptions.length > 0 ? filteredOptions.map((icon) => (
              <Button
                key={icon}
                type="button"
                variant={normalizedValue === icon ? 'primary' : 'outline-secondary'}
                className="d-flex align-items-center justify-content-center"
                title={icon}
                onClick={() => handleSelect(icon)}
                style={{ width: '42px', height: '42px', padding: 0 }}
              >
                <span className={icon} aria-hidden="true" style={{ fontSize: '1.15rem' }} />
              </Button>
            )) : (
              <div className="text-muted small">No icons match your search.</div>
            )}
          </div>
        </div>
      )}
    </Form.Group>
  );
};

export default ElementorIconPicker;
