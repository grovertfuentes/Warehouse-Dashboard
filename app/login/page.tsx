import {redirect} from 'next/navigation';
import {hasWarehouseAccess} from '../../lib/warehouse-access';
import LoginForm from './login-form';
export const dynamic='force-dynamic';
export default async function LoginPage(){
  if(await hasWarehouseAccess())redirect('/');
  return <LoginForm/>;
}
